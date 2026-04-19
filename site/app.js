import { flashcards, grammar, kana, stages } from "./data.js";

const STORAGE_KEY = "nihongo-pocket-progress";

const state = {
  activeTab: "kana",
  kanaFilter: "hiragana",
  flashcardStage: "all",
  grammarStage: "all",
  flashcardIndex: 0,
  flashcardFlipped: false,
  progress: loadProgress()
};

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { known: {}, again: {}, reviewCount: 0 };
    }
    return JSON.parse(raw);
  } catch {
    return { known: {}, again: {}, reviewCount: 0 };
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
  if (!items.length) {
    return 0;
  }
  const learned = items.filter((item) => state.progress.known[item.id]).length;
  return Math.round((learned / items.length) * 100);
}

function renderHeroStats() {
  const metrics = [
    { label: "已掌握词卡", value: Object.keys(state.progress.known).length },
    { label: "累计复习", value: state.progress.reviewCount },
    { label: "当前目标", value: "N2" }
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

function renderRoadmap() {
  document.getElementById("roadmap").innerHTML = stages
    .map(
      (stage) => `
        <article class="roadmap-card">
          <span>${stage.label}</span>
          <h3>${stage.summary}</h3>
          <p>${stage.id === "kana" ? "建议先完成字符熟悉和基础发音。" : `当前词卡掌握度 ${completionForStage(stage.id)}%`}</p>
        </article>
      `
    )
    .join("");
}

function renderKana() {
  const activeList = kana[state.kanaFilter];
  document.getElementById("kana-grid").innerHTML = activeList
    .map(
      ([romanji, symbol]) => `
        <article class="kana-tile">
          <strong>${symbol}</strong>
          <span>${romanji}</span>
        </article>
      `
    )
    .join("");
}

function getFilteredFlashcards() {
  return state.flashcardStage === "all"
    ? flashcards
    : flashcards.filter((item) => item.stage === state.flashcardStage);
}

function currentFlashcard() {
  const filtered = getFilteredFlashcards();
  if (!filtered.length) {
    return null;
  }
  state.flashcardIndex %= filtered.length;
  return filtered[state.flashcardIndex];
}

function renderFlashcardFilters() {
  const options = [{ id: "all", label: "全部" }, ...stages.filter((stage) => stage.id !== "kana")];
  document.getElementById("flashcard-filters").innerHTML = options
    .map(
      (option) => `
        <button class="chip ${state.flashcardStage === option.id ? "active" : ""}" data-flashcard-stage="${option.id}">
          ${option.label}
        </button>
      `
    )
    .join("");
}

function renderFlashcard() {
  const card = currentFlashcard();
  const el = document.getElementById("flashcard");
  if (!card) {
    el.innerHTML = "<p>当前阶段还没有词卡。</p>";
    return;
  }

  el.innerHTML = `
    <div class="flashcard-stage">
      <span>${stageLabel(card.stage)}</span>
      <span>${state.flashcardIndex + 1} / ${getFilteredFlashcards().length}</span>
    </div>
    <div>
      <div class="flashcard-face">${card.front}</div>
      <p class="flashcard-hint">读音：${card.reading}</p>
      ${
        state.flashcardFlipped
          ? `<div class="flashcard-back"><strong>${card.back}</strong><p class="flashcard-hint">${card.hint}</p></div>`
          : `<p class="flashcard-hint">先回忆意思，再点“翻面”。</p>`
      }
    </div>
  `;
}

function renderGrammarFilters() {
  const options = [{ id: "all", label: "全部" }, ...stages.filter((stage) => ["n5", "n4", "n3", "n2"].includes(stage.id))];
  document.getElementById("grammar-filters").innerHTML = options
    .map(
      (option) => `
        <button class="chip ${state.grammarStage === option.id ? "active" : ""}" data-grammar-stage="${option.id}">
          ${option.label}
        </button>
      `
    )
    .join("");
}

function renderGrammarList() {
  const items = state.grammarStage === "all" ? grammar : grammar.filter((item) => item.stage === state.grammarStage);
  document.getElementById("grammar-list").innerHTML = items
    .map(
      (item) => `
        <article class="grammar-card">
          <span>${stageLabel(item.stage)}</span>
          <h3>${item.title}</h3>
          <p class="grammar-meta">${item.meaning}</p>
          <p><strong>结构：</strong>${item.structure}</p>
          <p><strong>例句：</strong>${item.example}</p>
          <p class="grammar-meta">${item.note}</p>
        </article>
      `
    )
    .join("");
}

function renderProgress() {
  const metrics = [
    { label: "已掌握", value: `${Object.keys(state.progress.known).length} 张` },
    { label: "需加强", value: `${Object.keys(state.progress.again).length} 张` },
    { label: "总复习次数", value: `${state.progress.reviewCount} 次` },
    ...stages
      .filter((stage) => ["starter", "n5", "n4", "n3", "n2"].includes(stage.id))
      .map((stage) => ({ label: `${stage.label} 完成度`, value: `${completionForStage(stage.id)}%` }))
  ];

  document.getElementById("progress-cards").innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric">
          <span>${metric.label}</span>
          <h3>${metric.value}</h3>
          <p>当前保存在本机浏览器，后续可升级为云端同步。</p>
        </article>
      `
    )
    .join("");
}

function bindTabEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === state.activeTab);
      });
    });
  });
}

function bindKanaEvents() {
  document.querySelectorAll("[data-kana-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kanaFilter = button.dataset.kanaFilter;
      document.querySelectorAll("[data-kana-filter]").forEach((chip) => {
        chip.classList.toggle("active", chip === button);
      });
      renderKana();
    });
  });
}

function bindFlashcardEvents() {
  document.querySelectorAll("[data-flashcard-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      state.flashcardStage = button.dataset.flashcardStage;
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      renderFlashcardFilters();
      renderFlashcard();
      bindFlashcardEvents();
    });
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
  renderHeroStats();
  renderRoadmap();
  renderProgress();
  state.flashcardIndex += 1;
  state.flashcardFlipped = false;
  renderFlashcard();
}

function bindGrammarEvents() {
  document.querySelectorAll("[data-grammar-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      state.grammarStage = button.dataset.grammarStage;
      renderGrammarFilters();
      renderGrammarList();
      bindGrammarEvents();
    });
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

function init() {
  renderHeroStats();
  renderRoadmap();
  renderKana();
  renderFlashcardFilters();
  renderFlashcard();
  renderGrammarFilters();
  renderGrammarList();
  renderProgress();
  bindTabEvents();
  bindKanaEvents();
  bindFlashcardEvents();
  bindGrammarEvents();
  registerServiceWorker();
}

init();
