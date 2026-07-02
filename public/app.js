const STORAGE_KEY = "ops-turtle-soup.current-game.v1";
const DEFAULT_IDLE_CONFIG = {
  warningMs: 10 * 60 * 1000,
  closeMs: 15 * 60 * 1000,
  nuisanceMs: 30 * 1000
};

const state = {
  gameId: null,
  busy: false,
  solved: false,
  revealed: false,
  idleClosed: false,
  difficulty: "easy",
  scenarioScope: "delivery-fault",
  opening: "",
  progress: null,
  messages: [],
  startedAt: 0,
  endedAt: 0,
  lastActivityAt: 0,
  warningShown: false,
  nuisanceIndex: 0,
  nextNuisanceAt: 0,
  nuisancePersonality: "",
  customerLanguage: "",
  soundEnabled: false,
  completionFeedbackShown: false
};

const idleConfig = {
  ...DEFAULT_IDLE_CONFIG,
  ...(window.__OPS_TURTLE_IDLE_CONFIG__ || {})
};

const difficulty = document.querySelector("#difficulty");
const scenarioScope = document.querySelector("#scenarioScope");
const startBtn = document.querySelector("#startBtn");
const revealBtn = document.querySelector("#revealBtn");
const askForm = document.querySelector("#askForm");
const askBtn = document.querySelector("#askBtn");
const questionInput = document.querySelector("#questionInput");
const openingText = document.querySelector("#openingText");
const chatLog = document.querySelector("#chatLog");
const llmStatus = document.querySelector("#llmStatus");
const progressPanel = document.querySelector("#progressPanel");
const progressLabel = document.querySelector("#progressLabel");
const progressPercent = document.querySelector("#progressPercent");
const progressFill = document.querySelector("#progressFill");
const progressHint = document.querySelector("#progressHint");
const nuisanceWidget = document.querySelector("#nuisanceWidget");
const nuisanceRole = document.querySelector("#nuisanceRole");
const nuisanceText = document.querySelector("#nuisanceText");
const nuisanceTranslation = document.querySelector("#nuisanceTranslation");
const soundToggle = document.querySelector("#soundToggle");
const gameTimer = document.querySelector("#gameTimer");
const elapsedTime = document.querySelector("#elapsedTime");

let translationTimer = null;
let audioContext = null;

startBtn.addEventListener("click", startGame);
revealBtn.addEventListener("click", revealAnswer);
askForm.addEventListener("submit", askQuestion);
questionInput.addEventListener("input", noteActivity);
soundToggle?.addEventListener("click", toggleNuisanceSound);

restoreSavedGame();
window.setInterval?.(tickGameClock, 1000);
tickGameClock();

async function startGame() {
  setBusy(true);
  try {
    const data = await postJson("/api/game/start", {
      difficulty: difficulty.value,
      scenarioScope: scenarioScope.value
    });

    resetStateForNewGame(data);
    openingText.textContent = data.scenario.opening;
    updateProgress(data.progress);
    chatLog.innerHTML = "";
    addMessage("host", "值班主持", "你可以开始提问。请尽量问能用“是/否”回答的问题。");
    questionInput.disabled = false;
    askBtn.disabled = false;
    revealBtn.disabled = false;
    llmStatus.textContent = "进行中";
    saveGameState();
    speakNuisance(true);
    questionInput.focus();
  } catch (error) {
    addMessage("host", "系统", error.message);
  } finally {
    setBusy(false);
  }
}

async function askQuestion(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || !state.gameId || state.busy) return;

  questionInput.value = "";
  noteActivity();
  addMessage("player", "玩家", question);
  setBusy(true);

  try {
    const data = await postJson("/api/game/ask", {
      gameId: state.gameId,
      question
    });
    const answer = data.answer;
    addMessage("host", "主持", answer);
    updateProgress(data.progress);
    if (data.solved) {
      handleSolved(data.reveal);
    } else {
      saveGameState();
    }
  } catch (error) {
    addMessage("host", "系统", error.message);
    if (isExpiredGameError(error)) closeGameLocally("这局已经过期或被关闭，请重新开始。");
  } finally {
    setBusy(false);
    questionInput.focus();
  }
}

async function revealAnswer() {
  if (!state.gameId || state.busy) return;
  noteActivity();
  setBusy(true);

  try {
    const data = await postJson("/api/game/reveal", { gameId: state.gameId });
    state.revealed = true;
    completeGame();
    updateProgress(data.progress);
    renderReveal(data);
    llmStatus.textContent = "已揭晓";
    questionInput.disabled = true;
    askBtn.disabled = true;
    revealBtn.disabled = true;
    speakCompletionFeedback();
    saveGameState();
  } catch (error) {
    addMessage("host", "系统", error.message);
    if (isExpiredGameError(error)) closeGameLocally("这局已经过期或被关闭，请重新开始。");
  } finally {
    setBusy(false);
  }
}

function resetStateForNewGame(data) {
  const now = Date.now();
  state.gameId = data.gameId;
  state.busy = false;
  state.solved = false;
  state.revealed = false;
  state.idleClosed = false;
  state.difficulty = data.scenario.difficulty || difficulty.value;
  state.scenarioScope = data.scenario.scenarioScope || scenarioScope.value;
  state.opening = data.scenario.opening;
  state.progress = data.progress || null;
  state.messages = [];
  state.startedAt = now;
  state.endedAt = 0;
  state.lastActivityAt = now;
  state.warningShown = false;
  state.nuisanceIndex = 0;
  state.nextNuisanceAt = now + idleConfig.nuisanceMs;
  state.nuisancePersonality = pickNuisancePersonality(state.scenarioScope);
  state.customerLanguage = state.scenarioScope === "solution-clarification" ? pickCustomerLanguage() : "";
  state.completionFeedbackShown = false;
  difficulty.value = state.difficulty;
  scenarioScope.value = state.scenarioScope;
  updateSoundToggle();
  setTimerVisible(true);
}

function handleSolved(reveal) {
  if (state.solved) return;

  state.solved = true;
  completeGame();
  llmStatus.textContent = "已破案";
  questionInput.disabled = true;
  askBtn.disabled = true;
  revealBtn.disabled = true;
  playCelebration();

  if (reveal) {
    updateProgress(reveal.progress || { percent: 100, label: "已破案", hint: "谜底已经揭晓。" });
    renderReveal(reveal, "破案");
  }

  speakCompletionFeedback();
  saveGameState();
}

function completeGame() {
  if (!state.endedAt) state.endedAt = Date.now();
  state.nextNuisanceAt = 0;
}

function updateProgress(progress) {
  if (!progressPanel || !progress) return;

  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  state.progress = {
    percent,
    label: progress.label || "排查中",
    hint: progress.hint || "继续用是/否问题缩小范围。"
  };
  progressPanel.hidden = false;
  progressLabel.textContent = state.progress.label;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressHint.textContent = state.progress.hint;
  saveGameState();
}

function renderReveal(data, title = "揭晓") {
  const points = Array.isArray(data.solvePoints) ? data.solvePoints.join("；") : "";
  const infraBackground = formatRevealInfraBackground(data);
  addMessage(
    "host reveal",
    title,
    `基础设施：${infraBackground}\n真相：${data.hiddenTruth}\n关键点：${points}\n经验：${data.lesson}`
  );
}

function formatRevealInfraBackground(data) {
  const serverText = typeof data.infraBackgroundText === "string" ? data.infraBackgroundText.trim() : "";
  if (serverText && serverText !== "[object Object]") return serverText;

  if (data.infraBackgroundRaw !== undefined) return formatInfraBackground(data.infraBackgroundRaw);
  if (data.infraBackground !== undefined) return formatInfraBackground(data.infraBackground);
  return formatInfraBackground(data.infra_background);
}

function formatInfraBackground(value) {
  if (value === null || value === undefined || value === "") return "无";
  if (String(value) === "[object Object]" && typeof value !== "object") return "无";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(formatInfraValue).join("、");

  const entries = Object.entries(value);
  if (!entries.length) return "无";

  return entries
    .map(([key, item]) => `${key}: ${formatInfraValue(item)}`)
    .join("；");
}

function formatInfraValue(value) {
  if (value === null || value === undefined || value === "") return "无";
  if (Array.isArray(value)) return value.map(formatInfraValue).join("、");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}=${formatInfraValue(item)}`)
      .join(", ");
  }
  return String(value);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function addMessage(type, name, content, options = {}) {
  const persist = options.persist !== false;
  appendMessage(type, name, content);
  if (persist) {
    state.messages.push({ type, name, content });
    saveGameState();
  }
}

function appendMessage(type, name, content) {
  const item = document.createElement("div");
  item.className = `message ${type}`;

  const title = document.createElement("strong");
  title.textContent = name;

  const body = document.createElement("span");
  body.textContent = content;

  item.append(title, body);
  chatLog.append(item);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function playCelebration() {
  const layer = document.querySelector("#celebration");
  if (!layer) return;

  layer.innerHTML = "";
  layer.classList.remove("show");

  const pieces = 28;
  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement("span");
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--delay", `${Math.random() * 0.18}s`);
    piece.style.setProperty("--drift", `${Math.random() * 140 - 70}px`);
    piece.style.setProperty("--spin", `${Math.random() * 520 + 180}deg`);
    layer.append(piece);
  }

  requestAnimationFrame(() => layer.classList.add("show"));
  window.setTimeout(() => layer.classList.remove("show"), 1800);
}

function setBusy(value) {
  state.busy = value;
  startBtn.disabled = value;
  askBtn.disabled = value || !state.gameId || questionInput.disabled;
  revealBtn.disabled = value || !state.gameId || state.solved || state.revealed || state.idleClosed;

  if (value) {
    llmStatus.textContent = "处理中";
  } else if (!state.gameId) {
    llmStatus.textContent = "待开始";
  } else if (llmStatus.textContent === "处理中") {
    llmStatus.textContent = state.solved ? "已破案" : state.revealed ? "已揭晓" : "进行中";
  }
}

function restoreSavedGame() {
  const saved = readSavedGame();
  if (!saved?.gameId) {
    renderEmptyGame();
    return;
  }

  Object.assign(state, {
    ...state,
    ...saved,
    busy: false
  });

  const now = Date.now();
  if (!state.solved && !state.revealed && now - Number(state.lastActivityAt || now) >= idleConfig.closeMs) {
    closeRemoteGame(state.gameId);
    closeGameLocally("这局太久没有动作，已经自动关闭。");
    return;
  }

  difficulty.value = state.difficulty || "easy";
  scenarioScope.value = state.scenarioScope || "delivery-fault";
  openingText.textContent = state.opening || "已恢复上一局，但汤面记录不完整。";
  chatLog.innerHTML = "";
  for (const message of state.messages || []) {
    appendMessage(message.type, message.name, message.content);
  }
  if (!state.messages?.length) {
    appendMessage("host", "值班主持", "已恢复上一局。你可以继续提问。");
  }
  if (state.progress) updateProgress(state.progress);
  updateSoundToggle();
  setTimerVisible(true);
  setNuisanceVisible(true);
  llmStatus.textContent = state.solved ? "已破案" : state.revealed ? "已揭晓" : "进行中";
  questionInput.disabled = Boolean(state.solved || state.revealed || state.idleClosed);
  askBtn.disabled = questionInput.disabled;
  revealBtn.disabled = Boolean(state.solved || state.revealed || state.idleClosed);
  speakNuisance(false, { silent: true });
  saveGameState();
}

function renderEmptyGame() {
  setTimerVisible(false);
  setNuisanceVisible(false);
  questionInput.disabled = true;
  askBtn.disabled = true;
  revealBtn.disabled = true;
  llmStatus.textContent = "待开始";
  updateSoundToggle();
}

function saveGameState() {
  if (!state.gameId) return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
      gameId: state.gameId,
      solved: state.solved,
      revealed: state.revealed,
      idleClosed: state.idleClosed,
      difficulty: state.difficulty,
      scenarioScope: state.scenarioScope,
      opening: state.opening,
      progress: state.progress,
      messages: state.messages,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      lastActivityAt: state.lastActivityAt,
      warningShown: state.warningShown,
      nuisanceIndex: state.nuisanceIndex,
      nextNuisanceAt: state.nextNuisanceAt,
      nuisancePersonality: state.nuisancePersonality,
      customerLanguage: state.customerLanguage,
      soundEnabled: state.soundEnabled,
      completionFeedbackShown: state.completionFeedbackShown
    }));
  } catch {
    // Local storage can be disabled in some browsers; the game still works without restore.
  }
}

function readSavedGame() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSavedGame() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function noteActivity() {
  if (!state.gameId || state.solved || state.revealed || state.idleClosed) return;
  state.lastActivityAt = Date.now();
  state.warningShown = false;
  saveGameState();
}

function tickGameClock() {
  updateElapsedTime();
  handleIdleTimeout();
  handleNuisanceTimer();
}

function updateElapsedTime() {
  if (!state.gameId || !state.startedAt || !elapsedTime) return;
  setTimerVisible(true);
  const end = state.endedAt || Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((end - Number(state.startedAt)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  elapsedTime.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function handleIdleTimeout() {
  if (!state.gameId || state.solved || state.revealed || state.idleClosed) return;
  const idleMs = Date.now() - Number(state.lastActivityAt || Date.now());

  if (idleMs >= idleConfig.closeMs) {
    const closingGameId = state.gameId;
    closeRemoteGame(closingGameId);
    closeGameLocally("这局已经 15 分钟没有动作，系统已自动关闭。");
    return;
  }

  if (idleMs >= idleConfig.warningMs && !state.warningShown) {
    state.warningShown = true;
    addMessage("host", "系统", "已经 10 分钟没有动作了。再过 5 分钟没有操作，这局会自动关闭。");
    saveGameState();
  }
}

function handleNuisanceTimer() {
  if (!state.gameId || state.solved || state.revealed || state.idleClosed) return;
  if (!state.nextNuisanceAt) state.nextNuisanceAt = Date.now() + idleConfig.nuisanceMs;
  if (Date.now() >= state.nextNuisanceAt) {
    speakNuisance(true);
    state.nextNuisanceAt = Date.now() + idleConfig.nuisanceMs;
    saveGameState();
  }
}

function speakNuisance(advance, options = {}) {
  if (!nuisanceWidget || !state.gameId) return;
  const line = nextNuisanceLine(advance);
  setNuisanceVisible(true);
  nuisanceRole.textContent = line.role;
  nuisanceText.textContent = line.text;
  typeTranslation(line.translation || "");
  if (!options.silent) playNuisanceAudio(line.text, line.lang || "zh-CN");
}

function speakCompletionFeedback() {
  if (!nuisanceWidget || !state.gameId || state.completionFeedbackShown) return;
  state.completionFeedbackShown = true;
  const line = pickLine(completionPool());
  setNuisanceVisible(true);
  nuisanceRole.textContent = line.role;
  nuisanceText.textContent = line.text;
  typeTranslation(line.translation || "");
  playNuisanceAudio(line.text, line.lang || "zh-CN");
}

function nextNuisanceLine(advance) {
  const progress = Number(state.progress?.percent || 0);
  const pool = nuisancePool();
  const filtered = pool.filter((item) => progress >= item.min && progress <= item.max);
  const lines = filtered.length ? filtered : pool;
  const line = pickLine(lines, advance ? state.nuisanceIndex : Math.max(0, state.nuisanceIndex - 1));
  if (advance) state.nuisanceIndex += 1;
  return line;
}

function nuisancePool() {
  if (state.scenarioScope === "solution-clarification") return customerNuisancePool();
  return projectManagerNuisancePool();
}

function projectManagerNuisancePool() {
  const role = "项目经理";
  const personality = state.nuisancePersonality || "甩锅";
  const common = [
    { min: 0, max: 25, role, text: "客户已经在群里问第三遍了，你先别讲原理，先告诉我是不是我们的问题。" },
    { min: 0, max: 45, role, text: "你现在有把握吗？没把握也先给个方向，我好去稳住客户。" },
    { min: 25, max: 60, role, text: "进度条都动了，说明快到了吧？能不能先承诺一个恢复时间？" },
    { min: 45, max: 80, role, text: "这个点如果真是环境历史问题，你得把证据链准备好，别让我现场被问住。" },
    { min: 70, max: 100, role, text: "看起来快定位了，复盘里怎么写才能显得我们反应很快？" }
  ];
  const byPersonality = {
    "苛刻": [
      { min: 0, max: 50, role, text: "这个排查速度不太行，客户只看结果，不会听你解释链路复杂。" },
      { min: 50, max: 100, role, text: "既然已经接近根因了，为什么一开始没有直接定位到？" }
    ],
    "甩锅": [
      { min: 0, max: 55, role, text: "这个锅你先接一下，客户感受更重要，技术细节晚点再说。" },
      { min: 55, max: 100, role, text: "你确认不是你操作引起的吗？我刚刚已经说你在全力处理。" }
    ],
    "精明": [
      { min: 0, max: 45, role, text: "先别急着下结论，能不能把客户、环境、历史遗留这三块责任边界拆开？" },
      { min: 45, max: 100, role, text: "证据够了就把口径收窄，别把可选项说成承诺项。" }
    ],
    "啥都不懂": [
      { min: 0, max: 50, role, text: "所以这个 K8S 是数据库吗？你能不能用一句客户听得懂的话说？" },
      { min: 50, max: 100, role, text: "我理解一下，是不是重启一下就好了？如果不是，你别说太细。" }
    ]
  };
  return [...common, ...(byPersonality[personality] || [])];
}

function customerNuisancePool() {
  const language = state.customerLanguage || "en";
  const personality = state.nuisancePersonality || "苛刻";
  const lines = {
    en: [
      { min: 0, max: 35, role: "客户", lang: "en-US", text: "Budget stays the same. Why can't you give zero RPO and active-active today?", translation: "预算不变。为什么今天不能给 RPO≈0 和双活？" },
      { min: 25, max: 65, role: "客户", lang: "en-US", text: "I don't want technical limitations. I want the proposal to say it is highly available.", translation: "我不想听技术限制，我要方案写成高可用。" },
      { min: 60, max: 100, role: "客户", lang: "en-US", text: "I don't care about split-brain. Put it in the proposal and keep the price.", translation: "我不关心脑裂风险。写进方案里，价格别变。" }
    ],
    fr: [
      { min: 0, max: 35, role: "客户", lang: "fr-FR", text: "Le budget ne change pas. Pourquoi la haute disponibilite coute encore plus cher ?", translation: "预算不变。为什么高可用还要更贵？" },
      { min: 25, max: 65, role: "客户", lang: "fr-FR", text: "Je veux une solution sans perte de donnees, mais sans changer l'architecture.", translation: "我要不丢数据，但不要改架构。" },
      { min: 60, max: 100, role: "客户", lang: "fr-FR", text: "Vos contraintes techniques ne sont pas mon probleme, mettez une garantie dans le dossier.", translation: "技术限制不是我的问题，把保证写进方案。" }
    ],
    ru: [
      { min: 0, max: 35, role: "客户", lang: "ru-RU", text: "Бюджет не меняется. Почему вы не можете дать почти нулевую потерю данных?", translation: "预算不变。为什么不能给接近零的数据丢失？" },
      { min: 25, max: 65, role: "客户", lang: "ru-RU", text: "Нам не нужны ваши технические ограничения, нам нужен результат к пятнице.", translation: "我们不需要听技术限制，我们周五前要结果。" },
      { min: 60, max: 100, role: "客户", lang: "ru-RU", text: "Если это высокая доступность, почему вы снова говорите о рисках?", translation: "如果这是高可用，为什么你又在说风险？" }
    ],
    es: [
      { min: 0, max: 35, role: "客户", lang: "es-ES", text: "El presupuesto no cambia. Quiero alta disponibilidad sin comprar mas nada.", translation: "预算不变。我想要高可用，但不想再买任何东西。" },
      { min: 25, max: 65, role: "客户", lang: "es-ES", text: "Por que necesitamos mas almacenamiento? Solo pedi alta disponibilidad.", translation: "为什么还需要更多存储？我只是要高可用。" },
      { min: 60, max: 100, role: "客户", lang: "es-ES", text: "No me hables de detalles tecnicos. Dime que queda garantizado.", translation: "别跟我讲技术细节。告诉我什么能保证。" }
    ]
  };
  const personalityLines = {
    "苛刻": [{ min: 0, max: 100, role: "客户", lang: lines[language][0].lang, text: customerLocalizedText(language, "strict"), translation: "这个语气的核心意思是：别解释，给承诺。" }],
    "压预算": [{ min: 0, max: 100, role: "客户", lang: lines[language][0].lang, text: customerLocalizedText(language, "budget"), translation: "这个语气的核心意思是：预算不加，但能力要满。" }],
    "爱变更": [{ min: 0, max: 100, role: "客户", lang: lines[language][0].lang, text: customerLocalizedText(language, "change"), translation: "这个语气的核心意思是：需求继续加，价格别动。" }],
    "强势": [{ min: 0, max: 100, role: "客户", lang: lines[language][0].lang, text: customerLocalizedText(language, "force"), translation: "这个语气的核心意思是：不要技术解释，只要结果。" }]
  };
  return [...(lines[language] || lines.en), ...(personalityLines[personality] || [])];
}

function customerLocalizedText(language, intent) {
  const text = {
    en: {
      strict: "Stop explaining constraints. I need a commitment, not a lecture.",
      budget: "Keep the budget unchanged and still include everything we discussed.",
      change: "Add disaster recovery too. It should be included in the original price.",
      force: "Your technical details are internal. I only need the business result."
    },
    fr: {
      strict: "Arretez d'expliquer les contraintes. Je veux un engagement clair.",
      budget: "Gardez le meme budget et ajoutez tout ce dont nous avons parle.",
      change: "Ajoutez aussi la reprise apres sinistre, dans le prix initial.",
      force: "Vos details techniques sont internes. Je veux seulement le resultat metier."
    },
    ru: {
      strict: "Хватит объяснять ограничения. Мне нужно обязательство, а не лекция.",
      budget: "Оставьте тот же бюджет и включите все, что мы обсуждали.",
      change: "Добавьте аварийное восстановление тоже, в старую цену.",
      force: "Ваши технические детали внутренние. Мне нужен бизнес-результат."
    },
    es: {
      strict: "Deja de explicar limitaciones. Necesito un compromiso claro.",
      budget: "Mantenga el mismo presupuesto e incluya todo lo hablado.",
      change: "Agregue recuperacion ante desastres tambien, con el precio original.",
      force: "Sus detalles tecnicos son internos. Solo necesito el resultado de negocio."
    }
  };
  return text[language]?.[intent] || text.en[intent];
}

function completionPool() {
  if (state.scenarioScope === "solution-clarification") {
    return customerCompletionPool();
  }
  return [
    { role: "项目经理", text: "这次发现问题了，下次怎么避免？给我一句能写进复盘的。" },
    { role: "项目经理", text: "故障复盘会怎么解释？别写得像我们一开始没方向。" },
    { role: "项目经理", text: "好的，排查花费多少人力？客户问的时候我要有数。" },
    { role: "项目经理", text: "根因定位到了，那临时措施和永久措施分别怎么承诺？" },
    { role: "项目经理", text: "这次算你顶住了，但复盘里要把监控和预防动作补上。" }
  ];
}

function customerCompletionPool() {
  const language = state.customerLanguage || "en";
  const lines = {
    en: [
      { role: "客户", lang: "en-US", text: "Fine, you clarified the boundaries. Will those risks become your responsibility?", translation: "好，边界说清楚了。这些风险会不会变成你们的责任？" },
      { role: "客户", lang: "en-US", text: "I understand the trade-offs now, but I still expect the price to stay the same.", translation: "我现在理解取舍了，但我还是希望价格不变。" },
      { role: "客户", lang: "en-US", text: "Put this into the next proposal with a clear comparison table.", translation: "把这些写进下一版方案，并放一张清晰的对比表。" }
    ],
    fr: [
      { role: "客户", lang: "fr-FR", text: "D'accord, les limites sont claires. Mais qui porte le risque ensuite ?", translation: "好，边界清楚了。但后续风险由谁承担？" },
      { role: "客户", lang: "fr-FR", text: "Je comprends les choix, mais je veux toujours garder le meme prix.", translation: "我理解这些取舍，但价格我还是希望保持不变。" },
      { role: "客户", lang: "fr-FR", text: "Mettez cela dans la prochaine proposition avec un tableau comparatif.", translation: "把这些写进下一版方案，并附上对比表。" }
    ],
    ru: [
      { role: "客户", lang: "ru-RU", text: "Хорошо, границы понятны. Но кто потом отвечает за эти риски?", translation: "好，边界清楚了。但这些风险后续谁负责？" },
      { role: "客户", lang: "ru-RU", text: "Теперь я понимаю компромиссы, но цена должна остаться прежней.", translation: "我现在理解取舍了，但价格必须保持不变。" },
      { role: "客户", lang: "ru-RU", text: "Включите это в новую версию предложения с таблицей сравнения.", translation: "把这些写进新版方案，并提供对比表。" }
    ],
    es: [
      { role: "客户", lang: "es-ES", text: "Bien, los limites quedan claros. Pero quien asume esos riesgos despues?", translation: "好，边界清楚了。但这些风险后续谁承担？" },
      { role: "客户", lang: "es-ES", text: "Entiendo las concesiones, pero sigo esperando el mismo precio.", translation: "我理解取舍，但仍希望价格不变。" },
      { role: "客户", lang: "es-ES", text: "Incluya esto en la siguiente propuesta con una tabla comparativa.", translation: "把这些放进下一版方案，并加一张对比表。" }
    ]
  };
  return lines[language] || lines.en;
}

function pickNuisancePersonality(scope) {
  const personalities = scope === "solution-clarification"
    ? ["苛刻", "压预算", "爱变更", "强势"]
    : ["苛刻", "甩锅", "精明", "啥都不懂"];
  return pickLine(personalities);
}

function pickCustomerLanguage() {
  return pickLine(["en", "fr", "ru", "es"]);
}

function pickLine(items, seed = Math.floor(Math.random() * 100000)) {
  if (!items.length) return {};
  return items[Math.abs(seed) % items.length];
}

function toggleNuisanceSound() {
  state.soundEnabled = !state.soundEnabled;
  updateSoundToggle();
  saveGameState();
}

function updateSoundToggle() {
  if (!soundToggle) return;
  soundToggle.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
  soundToggle.textContent = state.soundEnabled ? "有声" : "静音";
  soundToggle.title = state.soundEnabled ? "关闭干扰音效" : "开启干扰音效";
}

function playNuisanceAudio(text, lang = "zh-CN") {
  if (!state.soundEnabled || !text) return;

  const speech = window.speechSynthesis;
  if (speech && window.SpeechSynthesisUtterance) {
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = state.scenarioScope === "solution-clarification" ? 0.92 : 1.05;
    utterance.pitch = state.scenarioScope === "solution-clarification" ? 0.82 : 1.08;
    utterance.volume = 0.78;
    speech.speak(utterance);
    return;
  }

  playFallbackBeep();
}

function playFallbackBeep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = state.scenarioScope === "solution-clarification" ? 420 : 620;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
}

function typeTranslation(text) {
  if (!nuisanceTranslation) return;
  window.clearInterval?.(translationTimer);
  nuisanceTranslation.textContent = "";
  if (!text) return;

  if (!window.setInterval) {
    nuisanceTranslation.textContent = text;
    return;
  }

  let index = 0;
  translationTimer = window.setInterval(() => {
    index += 1;
    nuisanceTranslation.textContent = text.slice(0, index);
    if (index >= text.length) window.clearInterval?.(translationTimer);
  }, 45);
}

function setTimerVisible(visible) {
  if (gameTimer) gameTimer.hidden = !visible;
}

function setNuisanceVisible(visible) {
  if (nuisanceWidget) nuisanceWidget.hidden = !visible;
}

function closeGameLocally(message) {
  clearSavedGame();
  state.gameId = null;
  state.solved = false;
  state.revealed = false;
  state.idleClosed = true;
  state.messages = [];
  state.progress = null;
  questionInput.disabled = true;
  askBtn.disabled = true;
  revealBtn.disabled = true;
  setTimerVisible(false);
  setNuisanceVisible(false);
  llmStatus.textContent = "已关闭";
  addMessage("host", "系统", message, { persist: false });
}

function closeRemoteGame(gameId) {
  if (!gameId) return;
  try {
    fetch("/api/game/close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Closing is best-effort; local state is still cleared.
  }
}

function isExpiredGameError(error) {
  return /不存在|过期|关闭/.test(String(error?.message || ""));
}
