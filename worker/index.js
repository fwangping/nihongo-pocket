const SESSION_COOKIE = "nihongo_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (!url.pathname.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }

    return assetResponse;
  }
};

async function handleApi(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await requireSession(request, env, false);
    return json({ user: session?.user ?? null });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    const password = String(body.password ?? "");

    if (!username || password.length < 6) {
      return json({ error: "用户名不能为空，密码至少 6 位。" }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (existing) {
      return json({ error: "这个用户名已经被使用了。" }, 409);
    }

    const userId = crypto.randomUUID();
    const { salt, hash } = await hashPassword(password);
    const now = new Date().toISOString();
    const defaultProgress = JSON.stringify({
      known: {},
      again: {},
      grammarDone: {},
      tasks: { kana: false },
      reviewCount: 0,
      lastStudiedAt: null
    });

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(userId, username, salt, hash, now),
      env.DB.prepare(
        "INSERT INTO user_progress (user_id, progress_json, updated_at) VALUES (?, ?, ?)"
      ).bind(userId, defaultProgress, now)
    ]);

    return createSessionResponse(request, env, userId, username);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    const password = String(body.password ?? "");

    const user = await env.DB.prepare(
      "SELECT id, username, password_salt, password_hash FROM users WHERE username = ?"
    ).bind(username).first();

    if (!user) {
      return json({ error: "用户名或密码不正确。" }, 401);
    }

    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      return json({ error: "用户名或密码不正确。" }, 401);
    }

    return createSessionResponse(request, env, user.id, user.username);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = getCookie(request, SESSION_COOKIE);
    if (token) {
      const tokenHash = await sha256Hex(token);
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (url.pathname === "/api/progress") {
    const session = await requireSession(request, env, true);
    if (session instanceof Response) {
      return session;
    }

    if (request.method === "GET") {
      const progress = await readProgress(env, session.user.id);
      return json({ progress });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      const progress = body.progress ?? {};
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO user_progress (user_id, progress_json, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET progress_json = excluded.progress_json, updated_at = excluded.updated_at"
      ).bind(session.user.id, JSON.stringify(progress), updatedAt).run();
      return json({ ok: true, updatedAt });
    }
  }

  return json({ error: "接口不存在。" }, 404);
}

async function requireSession(request, env, strict) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) {
    return strict ? json({ error: "请先登录。" }, 401) : null;
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    "SELECT sessions.user_id, users.username, sessions.expires_at " +
    "FROM sessions JOIN users ON sessions.user_id = users.id " +
    "WHERE sessions.token_hash = ?"
  ).bind(tokenHash).first();

  if (!session || session.expires_at < new Date().toISOString()) {
    return strict ? json({ error: "登录状态已过期，请重新登录。" }, 401) : null;
  }

  return {
    user: {
      id: session.user_id,
      username: session.username
    }
  };
}

async function createSessionResponse(request, env, userId, username) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), userId, tokenHash, expiresAt, now).run();

  return json(
    { ok: true, user: { id: userId, username } },
    200,
    { "Set-Cookie": buildSessionCookie(request, token) }
  );
}

async function readProgress(env, userId) {
  const row = await env.DB.prepare(
    "SELECT progress_json FROM user_progress WHERE user_id = ?"
  ).bind(userId).first();

  if (!row?.progress_json) {
    return null;
  }

  try {
    return JSON.parse(row.progress_json);
  } catch {
    return null;
  }
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  const found = cookies.find((entry) => entry.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function buildSessionCookie(request, token) {
  const url = new URL(request.url);
  const secure = url.hostname === "127.0.0.1" || url.hostname === "localhost" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePasswordBits(password, saltBytes) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256"
    },
    material,
    256
  );

  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await derivePasswordBits(password, saltBytes);
  return {
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(hashBytes)
  };
}

async function verifyPassword(password, saltBase64, hashBase64) {
  const saltBytes = base64ToBytes(saltBase64);
  const expectedBytes = base64ToBytes(hashBase64);
  const actualBytes = await derivePasswordBits(password, saltBytes);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= actualBytes[index] ^ expectedBytes[index];
  }
  return mismatch === 0;
}
