import { flashcards, grammar, kana, stages } from "./data.js";

const STORAGE_KEY = "nihongo-pocket-progress";
const defaultProgress = {
  known: {},
  again: {},
  grammarDone: {},
  tasks: { kana: false },
  reviewCount: 0
};

const state = {
  activeTab: "kana",
  kanaFilter: "hiragana",
  flashcardStage: "all",
  grammarStage: "all",
  flashcardIndex: 0,
  flashcardFlipped: false,
  weakOnly: false,
  progress: loadProgress()
};

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultProgress);
    return { ...structuredClone(defaultProgress), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultProgress);
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function stageLabel(id) {
  return stages.find((stage) => stage.id === id)?.label ?? id.toUpperCase();
}

function completionForStage(stageId) {
  const items = flashcards.filter((item) => item.stage === stageId);
  if (!items.length) return 0;
  const learned = items.filter((item) => state.progress.known[item.id]).length;
  return Math.round((learned / items.length) * 100);
}

function todaySummary() {
  const weakCount = Object.keys(state.progress.again).length;
  const grammarDone = Object.keys(state.progress.grammarDone).length;
  return [
    {
      id: "kana",
      badge: "起步",
      title: "先扫五十音",
      body: state.progress.tasks.kana ? "今天已完成字符热身。" : "用 3 分钟看一轮平假名或片假名。",
      cta: state.progress.tasks.kana ? "再看一轮" : "开始字符练习",
      tab: "kana"
    },
    {
      id: "flashcards",
      badge: "核心",
      title: weakCount ? `先复习 ${weakCount} 张薄弱词` : "刷 5 张闪卡",
      body: weakCount ? "优先把标记为“再来一次”的词卡复习掉。" : "今天先把一小组词卡翻完，不追求一次记住。",
      cta: weakCount ? "去复习薄弱词" : "开始背词",
      tab: "flashcards"
    },
    {
      id: "grammar",
      badge: "巩固",
      title: "读 1 条语法",
      body: grammarDone ? `已经标记 ${grammarDone} 条已读语法。` : "每次只看一两条，更容易坚持。",
      cta: "去看语法",
      tab: "grammar"
    }
  ];
}

function renderHeroStats() {
  const metrics = [
    { label: "已掌握词卡", value: Object.keys(state.progress.known).length },
    { label: "薄弱词卡", value: Object.keys(state.progress.again).length },
    { label: "累计复习", value: state.progress.reviewCount }
  ];
  document.getElementById("hero-stats").innerHTML = metrics.map((metric) => `
    <article class="stat-card">
      <p>${metric.label}</p>
      <strong>${metric.value}</strong>
    </article>
  `).join("");
}

function renderTodayGrid() {
  document.getElementById("today-grid").innerHTML = todaySummary().map((item) => `
    <article class="today-card">
      <span>${item.badge}</span>
      <strong>${item.title}</strong>
      <p>${item.body}</p>
      <button class="ghost" data-jump="${item.tab}">${item.cta}</button>
    </article>
  `).join("");
}

function renderRoadmap() {
  document.getElementById("roadmap").innerHTML = stages.map((stage) => `
    <article class="roadmap-card">
      <span>${stage.label}</span>
      <h3>${stage.summary}</h3>
      <p>${stage.id === "kana" ? "建议先完成字符熟悉和基础发音。" : `当前词卡掌握度 ${completionForStage(stage.id)}%`}</p>
    </article>
  `).join("");
}

function renderKana() {
  const activeList = kana[state.kanaFilter];
  document.getElementById("kana-grid").innerHTML = activeList.map(([romanji, symbol]) => `
    <article class="kana-tile">
      <strong>${symbol}</strong>
      <span>${romanji}</span>
    </article>
  `).join("");
}

function getFilteredFlashcards() {
  let items = state.flashcardStage === "all" ? flashcards : flashcards.filter((item) => item.stage === state.flashcardStage);
  if (state.weakOnly) {
    items = items.filter((item) => state.progress.again[item.id]);
  }
  return items;
}

function currentFlashcard() {
  const filtered = getFilteredFlashcards();
  if (!filtered.length) return null;
  state.flashcardIndex = state.flashcardIndex % filtered.length;
  return filtered[state.flashcardIndex];
}

function renderFlashcardFilters() {
  const options = [{ id: "all", label: "全部" }, ...stages.filter((stage) => stage.id !== "kana")];
  document.getElementById("flashcard-filters").innerHTML = options.map((option) => `
    <button class="chip ${state.flashcardStage === option.id ? "active" : ""}" data-flashcard-stage="${option.id}">${option.label}</button>
  `).join("");
  document.getElementById("weak-only-toggle").textContent = state.weakOnly ? "显示全部词" : "只看薄弱词";
}

function renderFlashcard() {
  const filtered = getFilteredFlashcards();
  const card = currentFlashcard();
  const el = document.getElementById("flashcard");
  if (!card) {
    el.innerHTML = `<div><div class="flashcard-face">很好</div><p class="flashcard-hint">当前筛选下没有词卡了，可以切换阶段或退出“只看薄弱词”。</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="flashcard-stage">
      <span>${stageLabel(card.stage)}</span>
      <span>${state.flashcardIndex + 1} / ${filtered.length}</span>
    </div>
    <div>
      <div class="flashcard-face">${card.front}</div>
      <p class="flashcard-hint">读音：${card.reading}</p>
      ${state.flashcardFlipped
        ? `<div class="flashcard-back"><strong>${card.back}</strong><p class="flashcard-hint">${card.hint}</p></div>`
        : `<p class="flashcard-hint">先自己回忆意思，再点“翻面”。</p>`}
    </div>
  `;
}

function renderGrammarFilters() {
  const options = [{ id: "all", label: "全部" }, ...stages.filter((stage) => ["n5", "n4", "n3", "n2"].includes(stage.id))];
  document.getElementById("grammar-filters").innerHTML = options.map((option) => `
    <button class="chip ${state.grammarStage === option.id ? "active" : ""}" data-grammar-stage="${option.id}">${option.label}</button>
  `).join("");
}

function renderGrammarList() {
  const items = state.grammarStage === "all" ? grammar : grammar.filter((item) => item.stage === state.grammarStage);
  document.getElementById("grammar-list").innerHTML = items.map((item) => `
    <article class="grammar-card">
      <span>${stageLabel(item.stage)}</span>
      <h3>${item.title}</h3>
      <p class="grammar-meta">${item.meaning}</p>
      <p><strong>结构：</strong>${item.structure}</p>
      <p><strong>例句：</strong>${item.example}</p>
      <p class="grammar-meta">${item.note}</p>
      <button class="ghost" data-grammar-done="${item.id}">${state.progress.grammarDone[item.id] ? "已标记已读" : "标记已读"}</button>
    </article>
  `).join("");
}

function renderProgress() {
  const metrics = [
    { label: "已掌握", value: `${Object.keys(state.progress.known).length} 张` },
    { label: "需加强", value: `${Object.keys(state.progress.again).length} 张` },
    { label: "总复习次数", value: `${state.progress.reviewCount} 次` },
    { label: "已读语法", value: `${Object.keys(state.progress.grammarDone).length} 条` },
    ...stages.filter((stage) => ["starter", "n5", "n4", "n3", "n2"].includes(stage.id)).map((stage) => ({
      label: `${stage.label} 完成度`,
      value: `${completionForStage(stage.id)}%`
    }))
  ];

  document.getElementById("progress-cards").innerHTML = metrics.map((metric) => `
    <article class="metric">
      <span>${metric.label}</span>
      <h3>${metric.value}</h3>
      <p>当前保存在本机浏览器，后续可升级为云端同步。</p>
    </article>
  `).join("");
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabId));
}

function refreshAll() {
  renderHeroStats();
  renderTodayGrid();
  renderRoadmap();
  renderKana();
  renderFlashcardFilters();
  renderFlashcard();
  renderGrammarFilters();
  renderGrammarList();
  renderProgress();
  bindDynamicEvents();
}

function reviewCurrentCard(type) {
  const card = currentFlashcard();
  if (!card) return;
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
    state.progress = structuredClone(defaultProgress);
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    saveProgress();
    refreshAll();
    setActiveTab("progress");
  };
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
    button.onclick = () => setActiveTab(button.dataset.jump === "today" ? "kana" : button.dataset.jump);
  });

  document.querySelectorAll("[data-grammar-done]").forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.grammarDone;
      state.progress.grammarDone[id] = true;
      saveProgress();
      refreshAll();
      setActiveTab("grammar");
    };
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}

function init() {
  bindStaticEvents();
  refreshAll();
  setActiveTab(state.activeTab);
  registerServiceWorker();
}

init();
