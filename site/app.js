import { flashcards, grammar, kanaGroups, stages } from "./data.js";

const STORAGE_KEY = "nihongo-pocket-progress";
const QUIZ_THRESHOLDS = {
  kana: { minAttempts: 12, target: 70 },
  starter: { minAttempts: 12, target: 70 },
  n5: { minAttempts: 16, target: 75 },
  grammar: { minAttempts: 10, target: 70 }
};

const QUIZ_LABELS = {
  kana: "五十音",
  starter: "入门单词",
  n5: "N5 单词",
  grammar: "语法"
};

const defaultProgress = {
  known: {},
  again: {},
  grammarDone: {},
  tasks: { kana: false },
  reviewCount: 0,
  lastStudiedAt: null,
  quiz: {
    kana: { correct: 0, total: 0 },
    starter: { correct: 0, total: 0 },
    n5: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 }
  }
};

const state = {
  activeTab: "kana",
  kanaFilter: "hiragana",
  flashcardStage: "starter",
  grammarStage: "n5",
  flashcardQuery: "",
  grammarQuery: "",
  flashcardIndex: 0,
  flashcardFlipped: false,
  weakOnly: false,
  quizMode: "kana",
  quizQuestion: null,
  quizInput: "",
  quizSelectedOption: null,
  quizFeedback: null,
  progress: loadProgress(),
  auth: {
    apiAvailable: false,
    status: "checking",
    user: null,
    message: "Checking sync status...",
    tone: "default",
    syncing: false,
    lastSyncedAt: null
  }
};

let syncTimer = null;

function cloneDefaultProgress() {
  return structuredClone(defaultProgress);
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultProgress();
    }
    return mergeProgress(cloneDefaultProgress(), JSON.parse(raw));
  } catch {
    return cloneDefaultProgress();
  }
}

function mergeProgress(base, incoming) {
  return {
    ...cloneDefaultProgress(),
    ...base,
    ...incoming,
    known: { ...(base?.known ?? {}), ...(incoming?.known ?? {}) },
    again: { ...(base?.again ?? {}), ...(incoming?.again ?? {}) },
    grammarDone: { ...(base?.grammarDone ?? {}), ...(incoming?.grammarDone ?? {}) },
    tasks: { ...(base?.tasks ?? {}), ...(incoming?.tasks ?? {}) },
    quiz: {
      ...cloneDefaultProgress().quiz,
      ...(base?.quiz ?? {}),
      ...(incoming?.quiz ?? {})
    },
    reviewCount: Math.max(base?.reviewCount ?? 0, incoming?.reviewCount ?? 0)
  };
}

function persistLocalProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function setAuthMessage(message, tone = "default") {
  state.auth.message = message;
  state.auth.tone = tone;
}

function normalizeRomaji(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(list, count = 1, exclude = []) {
  const excluded = new Set(exclude);
  return shuffle(list.filter((item) => !excluded.has(item))).slice(0, count);
}

function stageLabel(id) {
  return stages.find((stage) => stage.id === id)?.label ?? id.toUpperCase();
}

function getQuizStats(mode) {
  return state.progress.quiz[mode] ?? { correct: 0, total: 0 };
}

function getQuizScore(mode) {
  const stats = getQuizStats(mode);
  if (!stats.total) {
    return 0;
  }
  return Math.round((stats.correct / stats.total) * 100);
}

function meetsQuizGoal(mode) {
  const stats = getQuizStats(mode);
  const rule = QUIZ_THRESHOLDS[mode];
  return stats.total >= rule.minAttempts && getQuizScore(mode) >= rule.target;
}

function getUnlockedModes() {
  return {
    kana: true,
    starter: meetsQuizGoal("kana"),
    n5: meetsQuizGoal("starter"),
    grammar: meetsQuizGoal("n5")
  };
}

function allGoalsComplete() {
  return meetsQuizGoal("kana") && meetsQuizGoal("starter") && meetsQuizGoal("n5") && meetsQuizGoal("grammar");
}

function nextGoalMessage() {
  if (!meetsQuizGoal("kana")) {
    return `先把五十音测验做到 ${QUIZ_THRESHOLDS.kana.target}% 以上，再进入入门单词。`;
  }
  if (!meetsQuizGoal("starter")) {
    return `入门单词测验达到 ${QUIZ_THRESHOLDS.starter.target}% 后，解锁 N5 单词。`;
  }
  if (!meetsQuizGoal("n5")) {
    return `N5 单词测验达到 ${QUIZ_THRESHOLDS.n5.target}% 后，解锁语法模拟题。`;
  }
  if (!meetsQuizGoal("grammar")) {
    return `语法模拟题达到 ${QUIZ_THRESHOLDS.grammar.target}% 后，这一轮学习就完成了。`;
  }
  return "当前阶段全部达标，可以继续添加 N4-N2 的新内容。";
}

function completionForStage(stageId) {
  if (stageId === "kana") {
    return getQuizScore("kana");
  }
  if (stageId === "starter") {
    return getQuizScore("starter");
  }
  if (stageId === "n5") {
    return Math.round((getQuizScore("n5") + getQuizScore("grammar")) / 2);
  }
  return 0;
}

function markStudied() {
  state.progress.lastStudiedAt = new Date().toISOString();
}

function saveProgress() {
  markStudied();
  persistLocalProgress();
  queueSync();
}

function queueSync() {
  if (!state.auth.user || !state.auth.apiAvailable) {
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncProgressToCloud(true);
  }, 700);
}

function todaySummary() {
  const weakCount = Object.keys(state.progress.again).length;
  const grammarDone = Object.keys(state.progress.grammarDone).length;
  return [
    {
      badge: "Step 1",
      title: state.progress.tasks.kana ? "五十音热身完成" : "先扫五十音",
      body: state.progress.tasks.kana
        ? "今天已经看过一轮字符表，现在更适合去做测验。"
        : "先花 3 分钟看平假名或片假名，然后立即做罗马字小测。",
      cta: "去五十音",
      tab: "kana"
    },
    {
      badge: "Step 2",
      title: meetsQuizGoal("kana") ? "开始入门单词测验" : "先通过五十音测验",
      body: meetsQuizGoal("kana")
        ? "五十音通过后，优先刷入门词，再进入 N5。"
        : "只有测验达标后才会解锁下一阶段，避免只是看过却没有记住。",
      cta: "去测验",
      tab: "quiz"
    },
    {
      badge: "Step 3",
      title: weakCount ? `复习 ${weakCount} 个薄弱词` : `已读 ${grammarDone} 条语法`,
      body: weakCount
        ? "把点过“再来一次”的词优先消化，记忆效率会更高。"
        : "学完单词后，再看语法并做 JLPT 风格选择题。",
      cta: weakCount ? "去闪卡" : "去语法",
      tab: weakCount ? "flashcards" : "grammar"
    }
  ];
}

function renderHeroStats() {
  const metrics = [
    { label: "已掌握词卡", value: Object.keys(state.progress.known).length },
    { label: "薄弱词卡", value: Object.keys(state.progress.again).length },
    { label: "语法已读", value: Object.keys(state.progress.grammarDone).length },
    { label: "总完成度", value: `${Math.round((getQuizScore("kana") + getQuizScore("starter") + getQuizScore("n5") + getQuizScore("grammar")) / 4)}%` }
  ];
  document.getElementById("hero-stats").innerHTML = metrics
    .map(
      (metric) => `
        <article class="stat-card">
          <p>${metric.label}</p>
          <strong>${metric.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderTodayPlan() {
  document.getElementById("today-grid").innerHTML = todaySummary()
    .map(
      (item) => `
        <article class="today-card">
          <span>${item.badge}</span>
          <h3>${item.title}</h3>
          <p>${item.body}</p>
          <button class="ghost" data-jump="${item.tab}">${item.cta}</button>
        </article>
      `
    )
    .join("");
}

function renderRoadmap() {
  const cards = stages.map((stage) => {
    const completion = completionForStage(stage.id);
    const locked =
      (stage.id === "starter" && !getUnlockedModes().starter) ||
      (stage.id === "n5" && !getUnlockedModes().n5);

    return `
      <article class="roadmap-card">
        <span>${stage.label}</span>
        <h3>${locked ? "待解锁" : `${completion}%`}</h3>
        <p>${stage.summary}</p>
      </article>
    `;
  });
  document.getElementById("roadmap").innerHTML = cards.join("");
}

function renderAuthPanel() {
  const authPanel = document.getElementById("auth-panel");
  const chip = state.auth.user
    ? `<span class="auth-chip cloud">Cloud sync on</span>`
    : `<span class="auth-chip ${state.auth.apiAvailable ? "cloud" : "local"}">${state.auth.apiAvailable ? "Cloud ready" : "Local only"}</span>`;

  const accountCard = state.auth.user
    ? `
      <div class="auth-card">
        <div class="auth-buttons">${chip}</div>
        <h3>你好，${state.auth.user.username}</h3>
        <p class="auth-note">现在学习进度会保存在本地，并自动同步到云端。手机和电脑登录同一账号后会继续接着学。</p>
        <div class="auth-actions">
          <button class="primary" id="sync-now">${state.auth.syncing ? "同步中..." : "立即同步"}</button>
          <button class="ghost" id="logout-button">退出登录</button>
        </div>
        <p class="auth-note ${state.auth.tone}">${state.auth.message}</p>
      </div>
    `
    : `
      <div class="auth-card">
        <div class="auth-buttons">${chip}</div>
        <h3>登录后自动同步</h3>
        <p class="auth-note">
          ${state.auth.apiAvailable
            ? "注册一个用户名和密码后，手机和电脑就能共享同一份进度。"
            : "当前是纯静态预览模式，学习功能可用，但登录和云同步不可用。"}
        </p>
        <form class="auth-form" id="auth-form">
          <input class="text-input" id="auth-username" type="text" placeholder="用户名" autocomplete="username" ${state.auth.apiAvailable ? "" : "disabled"} />
          <input class="text-input" id="auth-password" type="password" placeholder="密码，至少 6 位" autocomplete="current-password" ${state.auth.apiAvailable ? "" : "disabled"} />
          <div class="auth-actions">
            <button class="primary" type="submit" ${state.auth.apiAvailable ? "" : "disabled"}>登录</button>
            <button class="ghost" type="button" id="register-button" ${state.auth.apiAvailable ? "" : "disabled"}>注册</button>
          </div>
        </form>
        <p class="auth-note ${state.auth.tone}">${state.auth.message}</p>
      </div>
    `;

  authPanel.innerHTML = `
    <div class="auth-layout">
      ${accountCard}
      <div class="auth-card">
        <span class="auth-chip local">流程提示</span>
        <h3>怎么学更顺</h3>
        <p class="auth-note">先看内容，再立刻做测验。五十音和单词都输入罗马字，语法用选择题。阶段达标后才解锁下一阶段。</p>
      </div>
      <div class="auth-card">
        <span class="auth-chip cloud">当前目标</span>
        <h3>${allGoalsComplete() ? "可以加新内容了" : "先把当前一轮学扎实"}</h3>
        <p class="auth-note">${nextGoalMessage()}</p>
        ${state.auth.lastSyncedAt ? `<p class="auth-note success">上次同步：${state.auth.lastSyncedAt}</p>` : ""}
      </div>
    </div>
  `;
}

function renderKana() {
  const groups = kanaGroups[state.kanaFilter];
  document.querySelectorAll("[data-kana-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.kanaFilter === state.kanaFilter);
  });

  document.getElementById("kana-groups").innerHTML = groups
    .map(
      (group) => `
        <article class="kana-group">
          <h3>${group.label}</h3>
          <p>${group.description}</p>
          <div class="kana-grid">
            ${group.items
              .map(
                ([romaji, kana]) => `
                  <article class="kana-tile">
                    <strong>${kana}</strong>
                    <span>${romaji}</span>
                  </article>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function getFlashcardsForStage(stageId) {
  let cards = flashcards.filter((item) => item.stage === stageId);
  const unlocked = getUnlockedModes();
  if (stageId === "starter" && !unlocked.starter) {
    return [];
  }
  if (stageId === "n5" && !unlocked.n5) {
    return [];
  }
  if (state.weakOnly) {
    cards = cards.filter((item) => state.progress.again[item.id]);
  }
  if (state.flashcardQuery.trim()) {
    const query = state.flashcardQuery.trim().toLowerCase();
    cards = cards.filter((item) =>
      [item.front, item.back, item.reading, item.category, item.hint, item.example].some((text) =>
        String(text ?? "").toLowerCase().includes(query)
      )
    );
  }
  return cards;
}

function renderFlashcardFilters() {
  const unlocked = getUnlockedModes();
  const options = [
    { id: "starter", label: "入门词" },
    { id: "n5", label: "N5 词" }
  ];

  document.getElementById("flashcard-filters").innerHTML = options
    .map((option) => {
      const locked = (option.id === "starter" && !unlocked.starter) || (option.id === "n5" && !unlocked.n5);
      return `
        <button class="chip ${state.flashcardStage === option.id ? "active" : ""}" data-flashcard-stage="${option.id}" ${locked ? "disabled" : ""}>
          ${option.label}${locked ? " (待解锁)" : ""}
        </button>
      `;
    })
    .join("");

  document.getElementById("weak-only-toggle").textContent = state.weakOnly ? "显示全部词" : "只看薄弱词";
}

function currentFlashcard() {
  const cards = getFlashcardsForStage(state.flashcardStage);
  if (!cards.length) {
    return null;
  }
  const index = state.flashcardIndex % cards.length;
  return cards[index];
}

function renderFlashcard() {
  renderFlashcardFilters();
  const card = currentFlashcard();
  const unlocked = getUnlockedModes();
  const panel = document.getElementById("flashcard");

  const locked =
    (state.flashcardStage === "starter" && !unlocked.starter) ||
    (state.flashcardStage === "n5" && !unlocked.n5);

  if (locked) {
    panel.innerHTML = `<p class="lock-note">${nextGoalMessage()}</p>`;
    return;
  }

  if (!card) {
    panel.innerHTML = `<p class="lock-note">当前筛选下没有可练习的词卡，可以切换阶段或关闭“只看薄弱词”。</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="flashcard-stage">
      <span>${card.category}</span>
      <span>${stageLabel(card.stage)}</span>
    </div>
    <div>
      <p class="flashcard-face">${card.front}</p>
      ${
        state.flashcardFlipped
          ? `
            <div class="flashcard-back">
              <strong>${card.back}</strong>
              <p class="flashcard-hint">罗马字：${card.reading}</p>
              <p class="flashcard-hint">${card.example}</p>
            </div>
          `
          : `<p class="flashcard-hint">先想想意思，再点翻面。提示：${card.hint}</p>`
      }
    </div>
  `;
}

function getGrammarList() {
  let items = grammar.filter((item) => item.stage === state.grammarStage);
  if (state.grammarQuery.trim()) {
    const query = state.grammarQuery.trim().toLowerCase();
    items = items.filter((item) =>
      [item.title, item.meaning, item.structure, item.example, item.note].some((text) =>
        String(text ?? "").toLowerCase().includes(query)
      )
    );
  }
  return items;
}

function renderGrammarFilters() {
  const unlocked = getUnlockedModes();
  const locked = !unlocked.grammar;
  document.getElementById("grammar-filters").innerHTML = `
    <button class="chip ${state.grammarStage === "n5" ? "active" : ""}" data-grammar-stage="n5" ${locked ? "disabled" : ""}>
      N5 语法${locked ? " (待解锁)" : ""}
    </button>
  `;
}

function renderGrammar() {
  renderGrammarFilters();
  const container = document.getElementById("grammar-list");
  if (!getUnlockedModes().grammar) {
    container.innerHTML = `<p class="lock-note">${nextGoalMessage()}</p>`;
    return;
  }

  container.innerHTML = getGrammarList()
    .map(
      (item) => `
        <article class="grammar-card">
          <span>${item.stage.toUpperCase()}</span>
          <h3>${item.title}</h3>
          <p class="grammar-meta">${item.meaning}</p>
          <p><strong>结构：</strong>${item.structure}</p>
          <p><strong>例句：</strong>${item.example}</p>
          <p class="grammar-meta">${item.note}</p>
          <button class="ghost" data-grammar-done="${item.id}">
            ${state.progress.grammarDone[item.id] ? "已读，点此取消" : "标记已读"}
          </button>
        </article>
      `
    )
    .join("");
}

function flattenKana() {
  return Object.entries(kanaGroups).flatMap(([script, groups]) =>
    groups.flatMap((group) =>
      group.items.map(([romaji, kana]) => ({
        script,
        group: group.label,
        romaji,
        kana
      }))
    )
  );
}

function createKanaQuestion() {
  const item = sample(flattenKana())[0];
  return {
    type: "input",
    mode: "kana",
    prompt: `写出这个假名的罗马字：${item.kana}`,
    helper: `${item.script === "hiragana" ? "平假名" : "片假名"} · ${item.group}`,
    answer: normalizeRomaji(item.romaji)
  };
}

function createVocabQuestion(stageId) {
  const item = sample(flashcards.filter((card) => card.stage === stageId))[0];
  return {
    type: "input",
    mode: stageId,
    prompt: `写出这个单词的罗马字：${item.front}`,
    helper: `${item.back} · ${item.category}`,
    answer: normalizeRomaji(item.reading)
  };
}

function createGrammarQuestion() {
  const item = sample(grammar)[0];
  const distractors = sample(
    grammar.map((entry) => entry.meaning),
    3,
    [item.meaning]
  );
  const options = shuffle([item.meaning, ...distractors]);
  return {
    type: "choice",
    mode: "grammar",
    prompt: `这条语法最接近哪一个意思？ ${item.title}`,
    helper: `结构：${item.structure}`,
    answer: item.meaning,
    options
  };
}

function createQuizQuestion(mode) {
  if (mode === "kana") {
    return createKanaQuestion();
  }
  if (mode === "starter") {
    return createVocabQuestion("starter");
  }
  if (mode === "n5") {
    return createVocabQuestion("n5");
  }
  return createGrammarQuestion();
}

function ensureQuizQuestion(force = false) {
  if (!state.quizQuestion || force) {
    state.quizQuestion = createQuizQuestion(state.quizMode);
    state.quizInput = "";
    state.quizSelectedOption = null;
    state.quizFeedback = null;
  }
}

function renderQuizOverview() {
  const modes = ["kana", "starter", "n5", "grammar"];
  document.getElementById("quiz-overview").innerHTML = modes
    .map((mode) => {
      const stats = getQuizStats(mode);
      const score = getQuizScore(mode);
      const rule = QUIZ_THRESHOLDS[mode];
      return `
        <article class="quiz-metric">
          <span>${QUIZ_LABELS[mode]}</span>
          <strong>${score}%</strong>
          <p>${stats.correct}/${stats.total} correct · target ${rule.target}% / ${rule.minAttempts} attempts</p>
        </article>
      `;
    })
    .join("");
}

function renderQuizFilters() {
  const unlocked = getUnlockedModes();
  const modes = [
    { id: "kana", label: "五十音", locked: false },
    { id: "starter", label: "入门词", locked: !unlocked.starter },
    { id: "n5", label: "N5 词", locked: !unlocked.n5 },
    { id: "grammar", label: "语法题", locked: !unlocked.grammar }
  ];

  document.getElementById("quiz-mode-filters").innerHTML = modes
    .map(
      (mode) => `
        <button class="chip ${state.quizMode === mode.id ? "active" : ""}" data-quiz-mode="${mode.id}" ${mode.locked ? "disabled" : ""}>
          ${mode.label}${mode.locked ? " (待解锁)" : ""}
        </button>
      `
    )
    .join("");
}

function renderQuizCard() {
  renderQuizOverview();
  renderQuizFilters();
  const card = document.getElementById("quiz-card");
  const actions = document.getElementById("quiz-actions");
  const locked =
    (state.quizMode === "starter" && !getUnlockedModes().starter) ||
    (state.quizMode === "n5" && !getUnlockedModes().n5) ||
    (state.quizMode === "grammar" && !getUnlockedModes().grammar);

  if (locked) {
    card.innerHTML = `<p class="lock-note">${nextGoalMessage()}</p>`;
    actions.innerHTML = "";
    return;
  }

  ensureQuizQuestion();
  const question = state.quizQuestion;

  if (question.type === "input") {
    card.innerHTML = `
      <span>${QUIZ_LABELS[state.quizMode]}</span>
      <h3>${question.prompt}</h3>
      <p>${question.helper}</p>
      <input id="quiz-input" class="quiz-input" type="text" placeholder="输入 romaji，例如 arigatou" value="${state.quizInput}" />
      ${state.quizFeedback ? `<p class="flashcard-hint ${state.quizFeedback.correct ? "success" : "error"}">${state.quizFeedback.message}</p>` : ""}
    `;
  } else {
    card.innerHTML = `
      <span>${QUIZ_LABELS[state.quizMode]}</span>
      <h3>${question.prompt}</h3>
      <p>${question.helper}</p>
      <div class="quiz-options">
        ${question.options
          .map(
            (option) => `
              <button class="quiz-option ${state.quizSelectedOption === option ? "active" : ""}" data-quiz-option="${option}">
                ${option}
              </button>
            `
          )
          .join("")}
      </div>
      ${state.quizFeedback ? `<p class="flashcard-hint ${state.quizFeedback.correct ? "success" : "error"}">${state.quizFeedback.message}</p>` : ""}
    `;
  }

  actions.innerHTML = `
    <button class="ghost" id="quiz-skip">换一题</button>
    <button class="primary" id="quiz-submit">${state.quizFeedback ? "下一题" : "提交答案"}</button>
  `;
}

function recordQuizResult(mode, correct) {
  const stats = getQuizStats(mode);
  state.progress.quiz[mode] = {
    correct: stats.correct + (correct ? 1 : 0),
    total: stats.total + 1
  };
  saveProgress();
}

function submitQuiz() {
  if (state.quizFeedback) {
    state.quizQuestion = null;
    state.quizInput = "";
    state.quizSelectedOption = null;
    state.quizFeedback = null;
    refreshAll();
    return;
  }

  const question = state.quizQuestion;
  if (!question) {
    return;
  }

  let correct = false;
  if (question.type === "input") {
    const answer = normalizeRomaji(state.quizInput);
    if (!answer) {
      state.quizFeedback = { correct: false, message: "先输入 romaji 再提交。" };
      renderQuizCard();
      bindDynamicEvents();
      return;
    }
    correct = answer === question.answer;
  } else {
    if (!state.quizSelectedOption) {
      state.quizFeedback = { correct: false, message: "先选一个答案再提交。" };
      renderQuizCard();
      bindDynamicEvents();
      return;
    }
    correct = state.quizSelectedOption === question.answer;
  }

  recordQuizResult(state.quizMode, correct);
  state.quizFeedback = {
    correct,
    message: correct
      ? `回答正确。当前 ${QUIZ_LABELS[state.quizMode]} 正确率 ${getQuizScore(state.quizMode)}%。`
      : `这题正确答案是 ${question.answer}。当前正确率 ${getQuizScore(state.quizMode)}%。`
  };

  if (state.quizMode === "kana" && correct) {
    state.progress.tasks.kana = true;
  }

  persistLocalProgress();
  refreshAll();
}

function renderProgress() {
  const cards = [
    {
      title: "五十音测验",
      body: `正确率 ${getQuizScore("kana")}% · ${getQuizStats("kana").correct}/${getQuizStats("kana").total}`
    },
    {
      title: "入门单词测验",
      body: `正确率 ${getQuizScore("starter")}% · ${getQuizStats("starter").correct}/${getQuizStats("starter").total}`
    },
    {
      title: "N5 单词测验",
      body: `正确率 ${getQuizScore("n5")}% · ${getQuizStats("n5").correct}/${getQuizStats("n5").total}`
    },
    {
      title: "语法模拟题",
      body: `正确率 ${getQuizScore("grammar")}% · ${getQuizStats("grammar").correct}/${getQuizStats("grammar").total}`
    },
    {
      title: "薄弱词复习",
      body: `当前有 ${Object.keys(state.progress.again).length} 个薄弱词，建议优先复习。`
    },
    {
      title: allGoalsComplete() ? "全部完成" : "下一目标",
      body: allGoalsComplete() ? "这一轮内容已经全部完成，可以考虑加入新的 N4-N2 内容。" : nextGoalMessage()
    }
  ];

  document.getElementById("progress-cards").innerHTML = cards
    .map(
      (card) => `
        <article class="metric">
          <span>${card.title}</span>
          <p>${card.body}</p>
        </article>
      `
    )
    .join("");
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });
}

function refreshAll() {
  renderHeroStats();
  renderAuthPanel();
  renderTodayPlan();
  renderRoadmap();
  renderKana();
  renderQuizCard();
  renderFlashcard();
  renderGrammar();
  renderProgress();
  bindDynamicEvents();
}

async function detectApi() {
  if (state.auth.status !== "checking") {
    return state.auth.apiAvailable;
  }

  try {
    await apiRequest("/api/health", { method: "GET" });
    state.auth.apiAvailable = true;
    state.auth.status = "guest";
    setAuthMessage("云同步可用，登录后会自动同步。");
    return true;
  } catch {
    state.auth.apiAvailable = false;
    state.auth.status = "offline";
    setAuthMessage("当前仅本地模式，学习内容仍可正常使用。");
    return false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    credentials: "include",
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function loadSession() {
  if (!(await detectApi())) {
    return;
  }

  try {
    const session = await apiRequest("/api/auth/session", { method: "GET" });
    if (!session.user) {
      state.auth.status = "guest";
      setAuthMessage("你还没有登录，可以先本地学习，或者注册后自动同步。");
      return;
    }

    state.auth.user = session.user;
    state.auth.status = "authenticated";
    await loadCloudProgress();
    setAuthMessage(`已连接云端账号：${session.user.username}`, "success");
  } catch {
    state.auth.status = "guest";
    setAuthMessage("云端状态读取失败，当前先使用本地数据。", "error");
  }
}

async function loadCloudProgress() {
  if (!state.auth.user) {
    return;
  }

  const payload = await apiRequest("/api/progress", { method: "GET" });
  state.progress = mergeProgress(payload.progress ?? cloneDefaultProgress(), state.progress);
  persistLocalProgress();
  await syncProgressToCloud(true);
}

async function syncProgressToCloud(silent = false) {
  if (!state.auth.user || !state.auth.apiAvailable) {
    return;
  }

  state.auth.syncing = true;
  refreshAll();

  try {
    await apiRequest("/api/progress", {
      method: "PUT",
      body: JSON.stringify({ progress: state.progress })
    });
    state.auth.lastSyncedAt = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
    if (!silent) {
      setAuthMessage("进度已同步到云端。", "success");
    }
  } catch (error) {
    setAuthMessage(error.message || "同步失败，请稍后重试。", "error");
  } finally {
    state.auth.syncing = false;
    refreshAll();
  }
}

async function handleAuth(action) {
  const username = document.getElementById("auth-username")?.value.trim();
  const password = document.getElementById("auth-password")?.value.trim();

  if (!username || !password) {
    setAuthMessage("请输入用户名和密码。", "error");
    refreshAll();
    return;
  }

  if (password.length < 6) {
    setAuthMessage("密码至少需要 6 位。", "error");
    refreshAll();
    return;
  }

  try {
    const payload = await apiRequest(`/api/auth/${action}`, {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    state.auth.user = payload.user;
    state.auth.status = "authenticated";
    setAuthMessage(action === "register" ? "注册成功，已自动登录并开始同步。" : "登录成功，正在同步你的进度。", "success");
    await loadCloudProgress();
  } catch (error) {
    setAuthMessage(error.message || "登录失败。", "error");
  }
  refreshAll();
}

async function handleLogout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {}
  state.auth.user = null;
  state.auth.status = "guest";
  state.auth.lastSyncedAt = null;
  setAuthMessage("已退出登录，当前继续使用本地进度。");
  refreshAll();
}

function reviewCurrentCard(type) {
  const card = currentFlashcard();
  if (!card) {
    return;
  }

  state.progress.reviewCount += 1;
  if (type === "known") {
    state.progress.known[card.id] = true;
    delete state.progress.again[card.id];
  } else {
    state.progress.again[card.id] = true;
  }
  saveProgress();
  state.flashcardIndex += 1;
  state.flashcardFlipped = false;
  refreshAll();
}

function bindStaticEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  document.getElementById("flip-card").onclick = () => {
    state.flashcardFlipped = !state.flashcardFlipped;
    renderFlashcard();
  };

  document.getElementById("next-card").onclick = () => {
    state.flashcardIndex += 1;
    state.flashcardFlipped = false;
    renderFlashcard();
  };

  document.getElementById("know-card").onclick = () => reviewCurrentCard("known");
  document.getElementById("again-card").onclick = () => reviewCurrentCard("again");

  document.getElementById("weak-only-toggle").onclick = () => {
    state.weakOnly = !state.weakOnly;
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    refreshAll();
  };

  document.getElementById("mark-kana-done").onclick = () => {
    state.progress.tasks.kana = true;
    saveProgress();
    refreshAll();
  };

  document.getElementById("reset-progress").onclick = () => {
    state.progress = cloneDefaultProgress();
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    state.quizQuestion = null;
    state.quizFeedback = null;
    persistLocalProgress();
    setAuthMessage("本地进度已重置。", "success");
    refreshAll();
  };

  document.getElementById("flashcard-search").addEventListener("input", (event) => {
    state.flashcardQuery = event.target.value;
    state.flashcardIndex = 0;
    refreshAll();
  });

  document.getElementById("grammar-search").addEventListener("input", (event) => {
    state.grammarQuery = event.target.value;
    refreshAll();
  });
}

function bindDynamicEvents() {
  document.querySelectorAll("[data-kana-filter]").forEach((button) => {
    button.onclick = () => {
      state.kanaFilter = button.dataset.kanaFilter;
      refreshAll();
      setActiveTab("kana");
    };
  });

  document.querySelectorAll("[data-flashcard-stage]").forEach((button) => {
    button.onclick = () => {
      state.flashcardStage = button.dataset.flashcardStage;
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      refreshAll();
      setActiveTab("flashcards");
    };
  });

  document.querySelectorAll("[data-grammar-stage]").forEach((button) => {
    button.onclick = () => {
      state.grammarStage = button.dataset.grammarStage;
      refreshAll();
      setActiveTab("grammar");
    };
  });

  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.onclick = () => setActiveTab(button.dataset.jump);
  });

  document.querySelectorAll("[data-grammar-done]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.grammarDone;
      if (state.progress.grammarDone[id]) {
        delete state.progress.grammarDone[id];
      } else {
        state.progress.grammarDone[id] = true;
      }
      saveProgress();
      refreshAll();
      setActiveTab("grammar");
    };
  });

  document.querySelectorAll("[data-quiz-mode]").forEach((button) => {
    button.onclick = () => {
      state.quizMode = button.dataset.quizMode;
      state.quizQuestion = null;
      state.quizInput = "";
      state.quizSelectedOption = null;
      state.quizFeedback = null;
      refreshAll();
      setActiveTab("quiz");
    };
  });

  document.getElementById("quiz-input")?.addEventListener("input", (event) => {
    state.quizInput = event.target.value;
  });

  document.querySelectorAll("[data-quiz-option]").forEach((button) => {
    button.onclick = () => {
      state.quizSelectedOption = button.dataset.quizOption;
      renderQuizCard();
      bindDynamicEvents();
    };
  });

  document.getElementById("quiz-submit")?.addEventListener("click", submitQuiz);

  document.getElementById("quiz-skip")?.addEventListener("click", () => {
    state.quizQuestion = null;
    state.quizInput = "";
    state.quizSelectedOption = null;
    state.quizFeedback = null;
    refreshAll();
  });

  document.getElementById("auth-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuth("login");
  });

  document.getElementById("register-button")?.addEventListener("click", () => {
    handleAuth("register");
  });

  document.getElementById("logout-button")?.addEventListener("click", () => {
    handleLogout();
  });

  document.getElementById("sync-now")?.addEventListener("click", () => {
    syncProgressToCloud();
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

async function init() {
  bindStaticEvents();
  await loadSession();
  refreshAll();
  setActiveTab(state.activeTab);
  registerServiceWorker();
}

init();
