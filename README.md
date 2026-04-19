# Nihongo Pocket

Nihongo Pocket is a mobile-first Japanese learning PWA designed for study from kana through JLPT N2. The first scaffold focuses on:

- kana study from gojuon
- flashcards with spaced-repetition-style feedback
- grammar browsing by stage
- local progress tracking
- GitHub + Cloudflare Pages deployment readiness

## Product direction

### Why this stack

- `Cloudflare Pages` for global hosting and GitHub auto-deploy
- `PWA` for mobile home-screen access without app-store packaging
- `Cloudflare D1` later for synced progress, custom decks, and shared content
- `Vanilla HTML/CSS/JS` in v1 so the app is easy to run, customize, and deploy

### Learning path

1. Kana
2. Starter words
3. N5 grammar + vocab
4. N4 grammar + vocab
5. N3 grammar + vocab
6. N2 grammar + vocab

### Recommended next milestones

1. Expand the bundled vocab and grammar JSON into full N5-N2 datasets
2. Add login and sync via Cloudflare Pages Functions + D1
3. Add review scheduling and daily streak logic
4. Add sentence audio and handwriting/typing drills

## Local preview

Open [site/index.html](D:\AI\nihongo-pocket\site\index.html) directly in a browser for a quick preview.

For a local static server:

```powershell
cd D:\AI\nihongo-pocket
npx serve site
```

## GitHub + Cloudflare Pages deployment

### Option A: recommended

1. Create a GitHub repo and push this folder
2. In Cloudflare Dashboard, open `Workers & Pages`
3. Create a new `Pages` project
4. Connect the GitHub repo
5. Use these build settings:

```txt
Framework preset: None
Build command: (leave empty)
Build output directory: site
Root directory: /
```

### Option B: deploy with Wrangler

```powershell
cd D:\AI\nihongo-pocket
npx wrangler whoami
npx wrangler pages deploy site --project-name nihongo-pocket
```

## Suggested future D1 schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE study_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stage TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE review_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE user_progress (
  user_id TEXT NOT NULL,
  track TEXT NOT NULL,
  stage TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, track, stage)
);
```
