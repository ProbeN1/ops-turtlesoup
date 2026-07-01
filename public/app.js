const state = {
  gameId: null,
  busy: false,
  solved: false
};

const difficulty = document.querySelector("#difficulty");
const startBtn = document.querySelector("#startBtn");
const revealBtn = document.querySelector("#revealBtn");
const askForm = document.querySelector("#askForm");
const askBtn = document.querySelector("#askBtn");
const questionInput = document.querySelector("#questionInput");
const openingText = document.querySelector("#openingText");
const chatLog = document.querySelector("#chatLog");
const llmStatus = document.querySelector("#llmStatus");
const chatPanel = document.querySelector(".chat-panel");
const toggleChatBtn = document.querySelector("#toggleChatBtn");

startBtn.addEventListener("click", startGame);
revealBtn.addEventListener("click", revealAnswer);
askForm.addEventListener("submit", askQuestion);
toggleChatBtn.addEventListener("click", toggleChat);

async function startGame() {
  setBusy(true);
  try {
    const data = await postJson("/api/game/start", { difficulty: difficulty.value });
    state.gameId = data.gameId;
    state.solved = false;
    openingText.textContent = data.scenario.opening;
    chatLog.innerHTML = "";
    addMessage("host", "值班主持", "你可以开始提问。请尽量问能用“是/否”回答的问题。");
    questionInput.disabled = false;
    askBtn.disabled = false;
    revealBtn.disabled = false;
    llmStatus.textContent = "进行中";
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
  addMessage("player", "玩家", question);
  setBusy(true);

  try {
    const data = await postJson("/api/game/ask", {
      gameId: state.gameId,
      question
    });
    const answer = [data.answer, data.nudge].filter(Boolean).join(" ");
    addMessage("host", "主持", answer);
    if (data.solved) {
      handleSolved(data.reveal);
    }
  } catch (error) {
    addMessage("host", "系统", error.message);
  } finally {
    setBusy(false);
    questionInput.focus();
  }
}

async function revealAnswer() {
  if (!state.gameId || state.busy) return;
  setBusy(true);

  try {
    const data = await postJson("/api/game/reveal", { gameId: state.gameId });
    renderReveal(data);
    llmStatus.textContent = "已揭晓";
    questionInput.disabled = true;
    askBtn.disabled = true;
  } catch (error) {
    addMessage("host", "系统", error.message);
  } finally {
    setBusy(false);
  }
}

function handleSolved(reveal) {
  if (state.solved) return;

  state.solved = true;
  setChatCollapsed(false);
  llmStatus.textContent = "已破案";
  questionInput.disabled = true;
  askBtn.disabled = true;
  revealBtn.disabled = true;
  playCelebration();

  if (reveal) {
    renderReveal(reveal, "破案");
  }
}

function renderReveal(data, title = "揭晓") {
  setChatCollapsed(false);
  const points = Array.isArray(data.solvePoints) ? data.solvePoints.join("；") : "";
  const infraBackground = data.infraBackgroundText || formatInfraBackground(data.infraBackground);
  addMessage(
    "host reveal",
    title,
    `基础设施：${infraBackground}\n真相：${data.hiddenTruth}\n关键点：${points}\n经验：${data.lesson}`
  );
}

function formatInfraBackground(value) {
  if (value === null || value === undefined || value === "") return "无";
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

function toggleChat() {
  setChatCollapsed(!chatPanel.classList.contains("chat-collapsed"));
}

function setChatCollapsed(collapsed) {
  chatPanel.classList.toggle("chat-collapsed", collapsed);
  toggleChatBtn.textContent = collapsed ? "展开对话" : "收起对话";
  toggleChatBtn.setAttribute("aria-expanded", String(!collapsed));
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

function addMessage(type, name, content) {
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
  revealBtn.disabled = value || !state.gameId || state.solved;

  if (value) {
    llmStatus.textContent = "处理中";
  } else if (!state.gameId) {
    llmStatus.textContent = "待开始";
  } else if (llmStatus.textContent === "处理中") {
    llmStatus.textContent = "进行中";
  }
}
