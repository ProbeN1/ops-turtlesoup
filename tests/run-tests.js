import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { createServer as createTcpServer } from "node:net";
import { createServer as createHttpServer } from "node:http";

const root = process.cwd();
const allowedHostAnswers = new Set(["是", "否", "无关"]);
const scenarioFiles = [
  ["easy", "data/scenarios/easy"],
  ["medium", "data/scenarios/medium"],
  ["hard", "data/scenarios/hard"]
];

const requiredScenarioFields = [
  "id",
  "title",
  "difficulty",
  "scenario_scope",
  "category",
  "tags",
  "infra_background",
  "story",
  "answer",
  "must_discover",
  "misleading",
  "forbidden",
  "question_rules",
  "thinking_path",
  "root_cause",
  "temporary_fix",
  "permanent_fix",
  "knowledge_points",
  "references"
];

const difficultyFileLabels = {
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(file) {
  return readFile(path.join(root, file), "utf8");
}

async function readScenarioSet(directory) {
  const difficulty = path.basename(directory);
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(files.map(async (file) => {
    const scenario = JSON.parse(await readText(path.join(directory, file)));
    assert(!Array.isArray(scenario), `${path.join(directory, file)} must contain one scenario object`);
    assert(file === scenarioFileName(scenario), `${path.join(directory, file)} filename must match difficulty-number-title format`);
    assert(file.startsWith(`${difficultyFileLabels[difficulty]}-`), `${path.join(directory, file)} filename must start with localized difficulty`);
    return scenario;
  }));
}

function scenarioFileName(scenario) {
  const label = difficultyFileLabels[scenario.difficulty];
  const number = String(scenario.id || "").split("-").pop();
  return `${label}-${number}-${safeScenarioFileTitle(scenario.title)}.json`;
}

function safeScenarioFileTitle(title) {
  return String(title || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

async function testScenarioSchema() {
  const seenIds = new Set();

  for (const [difficulty, directory] of scenarioFiles) {
    const scenarios = await readScenarioSet(directory);
    assert(scenarios.length >= 1, `${directory} must contain at least one scenario`);

    for (const scenario of scenarios) {
      for (const field of requiredScenarioFields) {
        assert(field in scenario, `${scenario.id || directory} missing ${field}`);
      }

      assert(scenario.difficulty === difficulty, `${scenario.id} difficulty must be ${difficulty}`);
      assert(["delivery-fault", "solution-clarification"].includes(scenario.scenario_scope), `${scenario.id} scenario_scope is invalid`);
      assert(!seenIds.has(scenario.id), `duplicate scenario id ${scenario.id}`);
      seenIds.add(scenario.id);
      assert(Array.isArray(scenario.tags), `${scenario.id} tags must be array`);
      assert(Array.isArray(scenario.must_discover), `${scenario.id} must_discover must be array`);
      assert(Array.isArray(scenario.question_rules.yes), `${scenario.id} question_rules.yes must be array`);
      assert(Array.isArray(scenario.question_rules.no), `${scenario.id} question_rules.no must be array`);
      assert(Array.isArray(scenario.question_rules.irrelevant), `${scenario.id} question_rules.irrelevant must be array`);
      assert(scenario.story.length > 20, `${scenario.id} story is too short`);
      assert(scenario.answer.length > 20, `${scenario.id} answer is too short`);
    }
  }
}

async function testFrontendBindings() {
  const html = await readText("public/index.html");
  const feedbackHtml = await readText("public/feedback.html");
  const updatesHtml = await readText("public/updates.html");
  const feedbackJs = await readText("public/feedback.js");
  const app = await readText("public/app.js");
  const css = await readText("public/styles.css");

  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const selectors = [...app.matchAll(/querySelector\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((selector) => selector.startsWith("#"))
    .map((selector) => selector.slice(1));

  for (const selector of selectors) {
    assert(ids.includes(selector), `public/app.js references missing #${selector}`);
  }

  assert(html.includes('value="easy"'), "frontend must use standard easy difficulty value");
  assert(html.includes('id="scenarioScope"'), "frontend must expose scenario scope selector");
  assert(html.includes('value="delivery-fault"'), "frontend must offer delivery fault scenario scope");
  assert(html.includes('value="solution-clarification"'), "frontend must offer solution clarification scenario scope");
  assert(html.includes('/app.js?v=20260702-nuisance-v1'), "frontend must version app.js after nuisance character changes");
  assert(html.includes('/styles.css?v=20260702-nuisance-v1'), "frontend must version styles.css after nuisance character changes");
  assert(html.includes("v0.11"), "frontend must show current version badge");
  assert(html.includes('href="/feedback"'), "frontend must link to feedback page");
  assert(html.includes('href="/updates.html"'), "frontend must link to update log page");
  assert(html.includes('class="game-page"'), "game page must opt into fixed viewport scrolling");
  assert(html.indexOf('for="scenarioScope"') < html.indexOf('for="difficulty"'), "scenario scope selector must appear before difficulty");
  assert(html.includes("select-row"), "home controls must group selectors on one row");
  assert(html.includes("action-row"), "home controls must group start and reveal on a separate row");
  assert(feedbackHtml.includes("0027029145"), "feedback page must expose DingTalk contact id");
  assert(feedbackHtml.includes("姜毅"), "feedback page must expose DingTalk contact name");
  assert(feedbackHtml.includes("jiang.yi12@iwhalecloud.com"), "feedback page must expose contact email");
  assert(feedbackHtml.includes("contactEmail"), "feedback page must allow copying contact email");
  assert(feedbackHtml.includes(">复制</button>"), "feedback page copy buttons must use readable text");
  assert(feedbackHtml.includes('/styles.css?v=20260702-nuisance-v1'), "feedback page must version styles.css after nuisance character changes");
  assert(feedbackHtml.includes("feedback-contact-list"), "feedback page must use the dedicated contact list layout");
  assert(feedbackHtml.includes("contact-card"), "feedback page must render contact details as cards");
  assert(!feedbackHtml.includes("⧉"), "feedback page must not use ambiguous copy glyphs");
  assert(feedbackHtml.includes("/feedback.js?v=20260701-dingtalk-v1"), "feedback page must version feedback.js");
  assert(feedbackHtml.includes("v0.11"), "feedback page must show current version badge");
  assert(updatesHtml.includes("更新记录"), "updates page must render an update log");
  assert(updatesHtml.includes("首页布局优化"), "updates page must mention the home layout update");
  assert(updatesHtml.includes('href="/"'), "updates page must link back to the game");
  assert(updatesHtml.includes('/styles.css?v=20260702-nuisance-v1'), "updates page must use the current styles.css version");
  assert(updatesHtml.includes("v0.11"), "updates page must include the current minor version");
  assert(updatesHtml.includes("干扰角色与局面恢复"), "updates page must document the nuisance character and restore update");
  assert(feedbackJs.includes("navigator.clipboard"), "feedback script must support copying contact details");
  assert(!feedbackJs.includes("/api/feedback"), "feedback script must not submit to removed feedback API");
  assert(app.includes("function formatRevealInfraBackground"), "frontend must normalize reveal infra fields before rendering");
  assert(app.includes("function formatInfraBackground"), "frontend must format infra background before rendering reveal");
  assert(app.includes("const answer = data.answer"), "frontend must not append host hints to answer messages");
  assert(!app.includes("基础设施：${data.infraBackground}"), "frontend must not render infra object directly");
  assert(!app.includes("[data.answer, data.nudge]"), "frontend must ignore nudge text in chat output");
  assert(!html.includes("toggleChatBtn"), "chat window must not expose a layout-changing collapse button");
  assert(html.includes("chat-window-label"), "chat header must label the embedded conversation window");
  assert(html.includes("progressPanel"), "opening panel must include RCA progress UI");
  assert(html.includes("nuisanceWidget"), "game page must include the nuisance character widget");
  assert(html.includes("gameTimer"), "game page must include elapsed game timer");
  assert(html.includes("soundToggle"), "nuisance widget must include a sound toggle");
  assert(html.includes("version-badge"), "game page must include horizontal version links");
  assert(feedbackHtml.includes('href="/updates.html"'), "feedback page version badge must link to update log");
  assert(updatesHtml.includes('href="/"'), "updates page version badge must link back to the game");
  assert(app.includes("function updateProgress"), "frontend must update RCA progress from API responses");
  assert(app.includes("STORAGE_KEY"), "frontend must persist current game state");
  assert(app.includes("restoreSavedGame"), "frontend must restore game state after navigation");
  assert(app.includes("endedAt"), "frontend must freeze elapsed timer after reveal or solve");
  assert(app.includes("/api/game/close"), "frontend must close stale games on idle timeout");
  assert(app.includes("warningMs: 10 * 60 * 1000"), "frontend must warn after ten idle minutes by default");
  assert(app.includes("closeMs: 15 * 60 * 1000"), "frontend must close after fifteen idle minutes by default");
  assert(app.includes("nuisanceMs: 30 * 1000"), "frontend nuisance character must speak every thirty seconds by default");
  assert(app.includes("customerLanguage"), "solution clarification scope must keep one customer language per game");
  assert(app.includes("pickCustomerLanguage"), "solution clarification scope must randomly choose a customer language once");
  assert(app.includes("客户"), "solution clarification nuisance role must display as customer");
  assert(!app.includes("苛责客户"), "solution clarification nuisance role must not display as harsh customer");
  assert(app.includes("项目经理"), "delivery fault scope must use the project manager nuisance role");
  assert(app.includes("nuisancePersonality"), "nuisance characters must keep hidden personalities in state");
  assert(app.includes("speechSynthesis"), "nuisance speech must support optional spoken audio");
  assert(app.includes("function speakCompletionFeedback"), "nuisance character must comment after reveal or solve");
  assert(app.includes("scenarioScope: scenarioScope.value"), "frontend must send selected scenario scope when starting a game");
  assert(css.includes("grid-template-rows: auto 1fr auto"), "chat window must keep header, scrollback, and ask form in fixed rows");
  assert(css.includes(".chat-log") && css.includes("min-height: 0"), "chat log must scroll inside the fixed chat window");
  assert(css.includes(".rca-progress"), "CSS must style the RCA progress UI");
  assert(css.includes(".nuisance-widget"), "CSS must style the nuisance character widget");
  assert(css.includes(".sound-toggle"), "CSS must style the nuisance sound toggle");
  assert(css.includes(".game-timer"), "CSS must style the elapsed game timer");
  assert(css.includes(".feedback-contact-list"), "CSS must style the dedicated feedback contact list");
  assert(css.includes(".select-row"), "CSS must style the selector row");
  assert(css.includes(".game-page") && css.includes("overflow: hidden"), "game page must prevent document-level scrolling");
  assert(css.includes(".game-page") && css.includes("overflow: auto"), "mobile game page must allow document scrolling");
  assert(css.includes(".action-row"), "CSS must style the action button row");
  assert(css.includes(".version-number"), "CSS must style the compact version number");
  assert(css.includes("flex-direction: row"), "version badge must lay out links horizontally");
  assert(css.includes(".updates-list"), "CSS must style the update log page");
  assert(css.includes(".contact-card"), "feedback contacts must render as stable contact cards");
  assert(css.includes("repeat(2, minmax(0, 1fr))"), "feedback contacts must use a two-column PC layout");
  assert(css.includes("4rem minmax(0, 1fr) auto"), "feedback contact cards must align label, value, and copy button on PC");
  assert(!css.includes(".dingtalk-contact"), "feedback contact layout must not depend on legacy DingTalk-only styles");
}

async function testRevealInfraFormatting() {
  const app = await readText("public/app.js");
  const elements = new Map();

  function createElement() {
    return {
      textContent: "",
      disabled: false,
      innerHTML: "",
      className: "",
      children: [],
      classList: {
        contains: () => false,
        toggle: () => {},
        remove: () => {},
        add: () => {}
      },
      style: { setProperty: () => {} },
      addEventListener: () => {},
      append(...items) {
        this.children.push(...items);
        this.lastAppend = items;
      },
      focus: () => {},
      setAttribute: () => {},
      scrollTop: 0,
      scrollHeight: 0
    };
  }

  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, createElement());
      }
      return elements.get(selector);
    },
    createElement
  };

  const context = {
    document,
    window: { setTimeout: () => {} },
    requestAnimationFrame: (fn) => fn(),
    Math,
    fetch: () => {},
    console
  };

  vm.runInNewContext(app, context);
  context.renderReveal({
    infraBackgroundText: "",
    infraBackground: {
      platform: "Proxmox",
      nodes: { workers: 2 },
      observability: ["Prometheus", "Grafana"]
    },
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const chatLog = elements.get("#chatLog");
  const lastMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(!lastMessageBody.includes("[object Object]"), "reveal must not show [object Object]");
  assert(lastMessageBody.includes("platform: Proxmox"), "reveal must include formatted infra key/value");
  assert(lastMessageBody.includes("nodes: workers=2"), "reveal must include nested infra values");

  context.renderReveal({
    infraBackgroundText: "platform: Bare metal K8S; storage: local SSD",
    infraBackground: { platform: { shouldNotRender: true } },
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const serverTextMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(serverTextMessageBody.includes("platform: Bare metal K8S; storage: local SSD"), "reveal must prefer server formatted infra text");
  assert(!serverTextMessageBody.includes("shouldNotRender"), "reveal must not reformat infra object when server text is present");

  context.renderReveal({
    infraBackgroundText: "[object Object]",
    infraBackground: {
      platform: "裸机 K8S",
      storage: { type: "本地 SSD" }
    },
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const badServerTextMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(!badServerTextMessageBody.includes("[object Object]"), "reveal must ignore object-like server infra text");
  assert(badServerTextMessageBody.includes("platform: 裸机 K8S"), "reveal must fall back to formatted infra object");

  context.renderReveal({
    infraBackgroundText: "",
    infraBackgroundRaw: {
      platform: "Bare metal K8S",
      storage: { volume: "/data" }
    },
    infraBackground: "[object Object]",
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const rawFallbackMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(!rawFallbackMessageBody.includes("[object Object]"), "reveal must prefer raw infra object over object-like compatibility text");
  assert(rawFallbackMessageBody.includes("platform: Bare metal K8S"), "reveal must format raw infra object fallback");

  context.renderReveal({
    infra_background: {
      platform: "磁阵 + 虚拟化",
      storage: { volume: "/data" }
    },
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const snakeCaseMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(!snakeCaseMessageBody.includes("[object Object]"), "reveal must format snake_case infra background");
  assert(snakeCaseMessageBody.includes("platform: 磁阵 + 虚拟化"), "reveal must support snake_case infra background");
}

async function testServerConfiguration() {
  const server = await readText("server.js");
  for (const token of [
    "LLM_MAX_CONCURRENCY",
    "LLM_QUEUE_LIMIT",
    "LLM_REQUEST_TIMEOUT_SECONDS",
    "fetchWithTimeout",
    "LLM request timed out",
    "RATE_LIMIT_WINDOW_SECONDS",
    "RATE_LIMIT_MAX_REQUESTS",
    "GET\" && req.url === \"/api/metrics",
    "req.url === \"/metrics\"",
    "publicMetrics",
    "prometheusMetrics",
    "ops_turtle_soup_http_requests_total",
    "text/plain; version=0.0.4",
    "gameQuestionsTotal",
    "server.requestTimeout",
    "SHUTDOWN_GRACE_SECONDS",
    "process.on(\"SIGTERM\"",
    "Startup failed:",
    "EADDRINUSE",
    "EACCES",
    "isLlmQueueFullError",
    '"cache-control": "no-store"',
    "jsonResponse(res, 503",
    "infraBackgroundText",
    "formatInfraBackground",
    "主持繁忙，请稍后再试",
    "readinessPayload",
    "GET\" && req.url === \"/api/ready",
    "apiKeyConfigured",
    "MAX_ACTIVE_SESSIONS",
    "maxActiveSessions",
    "房间已满，请稍后再试",
    "GET\" && req.url === \"/api/health",
    "scenarioScopes",
    "GET\" && req.url === \"/api/scenario-scopes",
    "filterScenariosByScope",
    "BUILD_INFO",
    "buildInfo",
    "RELEASE_INFO.json",
    "crypto.randomInt(items.length)",
    "progressPayload",
    "result.progress",
    "fallbackHostAnswer",
    "fallbacksTotal",
    "ops_turtle_soup_llm_fallbacks_total",
    "POST\" && req.url === \"/api/game/close"
  ]) {
    assert(server.includes(token), `server.js missing ${token}`);
  }

  for (const token of ["POST\" && req.url === \"/api/feedback", "FEEDBACK_EMAIL_TO", "SMTP_HOST", "sendSmtpMail"]) {
    assert(!server.includes(token), `server.js must not retain removed feedback email token ${token}`);
  }
}

async function testInvalidRuntimeConfiguration() {
  const result = await runNodeWithEnv({ PORT: "70000" });
  assert(result.code !== 0, "server must fail fast for invalid PORT");
  assert(result.stderr.includes("PORT must be <= 65535"), "invalid PORT error must explain valid range");
}

async function testGracefulShutdown() {
  const port = "5737";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: port, SHUTDOWN_GRACE_SECONDS: "2", SHUTDOWN_AFTER_START: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    const code = await waitForExit(child, 5000);
    assert(code === 0, `server must exit cleanly on graceful shutdown; code=${code} stdout=${stdout} stderr=${stderr}`);
    assert(stdout.includes("Received TEST"), "server must log graceful shutdown signal");
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(`${error.message}; stdout=${stdout}; stderr=${stderr}`);
  }
}

async function testStartupPortConflict() {
  const holder = createTcpServer();
  await new Promise((resolve, reject) => {
    holder.once("error", reject);
    holder.listen(0, "127.0.0.1", resolve);
  });
  const address = holder.address();
  const port = String(typeof address === "object" && address ? address.port : "");

  try {
    const result = await runNodeWithEnv({ HOST: "127.0.0.1", PORT: port });
    assert(result.code !== 0, "server must fail fast when the configured port is already in use");
    assert(result.stderr.includes("Startup failed:"), "port conflict error must include startup failure prefix");
    assert(result.stderr.includes("already in use"), "port conflict error must explain that the port is already in use");
  } finally {
    await new Promise((resolve) => holder.close(resolve));
  }
}

async function testLlmQueueFullFallsBack() {
  const blocker = createTcpServer((socket) => {
    socket.on("error", () => {});
  });
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const blockerAddress = blocker.address();
  const blockerPort = typeof blockerAddress === "object" && blockerAddress ? blockerAddress.port : 0;

  const appPort = await reserveLocalPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: `http://127.0.0.1:${blockerPort}/v1`,
      OPENAI_MODEL: "test-model",
      LLM_MAX_CONCURRENCY: "1",
      LLM_QUEUE_LIMIT: "1",
      LLM_REQUEST_TIMEOUT_SECONDS: "5",
      RATE_LIMIT_MAX_REQUESTS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`, 5000);
    const gameIds = [];
    for (let i = 0; i < 3; i += 1) {
      const start = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
      gameIds.push(start.gameId);
    }

    const controller = new AbortController();
    const asks = gameIds.map((gameId, index) => postJsonAllowError(`http://127.0.0.1:${appPort}/api/game/ask`, {
      gameId,
      question: `这是压力测试问题 ${index + 1} 吗？`
    }, controller.signal));

    const firstSettled = await Promise.race(asks.map((promise) => promise.then((result) => result)));
    controller.abort();
    await Promise.allSettled(asks);
    assert(firstSettled.status === 200, `queue overflow must fall back to local host answer, got ${firstSettled.status}`);
    assert(allowedHostAnswers.has(firstSettled.body.answer), `fallback answer must be allowed, got ${JSON.stringify(firstSettled.body.answer)}`);
    assert(firstSettled.body.nudge === "", "fallback answer must not include host hints");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
    await new Promise((resolve) => blocker.close(resolve));
  }

  assert(!stderr.includes("Startup failed"), `server startup failed unexpectedly; stdout=${stdout}; stderr=${stderr}`);
}

async function testLlmHttpFailureFallsBack() {
  const llm = createHttpServer((req, res) => {
    res.writeHead(429, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "quota exceeded" } }));
  });
  await new Promise((resolve, reject) => {
    llm.once("error", reject);
    llm.listen(0, "127.0.0.1", resolve);
  });
  const llmAddress = llm.address();
  const llmPort = typeof llmAddress === "object" && llmAddress ? llmAddress.port : 0;

  const appPort = await reserveLocalPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: `http://127.0.0.1:${llmPort}/v1`,
      OPENAI_MODEL: "test-model",
      RATE_LIMIT_MAX_REQUESTS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`, 5000);
    const start = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    const ask = await postJson(`http://127.0.0.1:${appPort}/api/game/ask`, {
      gameId: start.gameId,
      question: "这是备份问题吗？"
    });

    assert(allowedHostAnswers.has(ask.answer), `LLM HTTP failure fallback answer must be allowed, got ${JSON.stringify(ask.answer)}`);
    assert(typeof ask.solved === "boolean", "fallback ask response solved must be boolean");
    assert(ask.nudge === "", "fallback ask response must not include host hints");
    assert(ask.progress?.percent >= 0, "fallback ask response must include progress");

    const metrics = await getJson(`http://127.0.0.1:${appPort}/api/metrics`);
    assert(metrics.llm.failuresTotal >= 1, "LLM HTTP failure must increment llm failure counter");
    assert(metrics.llm.fallbacksTotal >= 1, "LLM HTTP failure must increment local fallback counter");

    const prometheus = await getText(`http://127.0.0.1:${appPort}/metrics`);
    assert(prometheus.includes("ops_turtle_soup_llm_fallbacks_total"), "Prometheus metrics must expose LLM fallback counter");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
    await new Promise((resolve) => llm.close(resolve));
  }

  assert(!stderr.includes("Startup failed"), `server startup failed unexpectedly; stdout=${stdout}; stderr=${stderr}`);
}

async function testRevealApiInfraPayload() {
  const appPort = await reserveLocalPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      RATE_LIMIT_MAX_REQUESTS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`, 5000);
    const started = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    const revealed = await postJson(`http://127.0.0.1:${appPort}/api/game/reveal`, { gameId: started.gameId });

    assert(typeof revealed.infraBackground === "string", "reveal infraBackground must be compatibility display text");
    assert(revealed.infraBackground && revealed.infraBackground !== "[object Object]", "reveal infraBackground must not be object text");
    assert(revealed.infraBackgroundText === revealed.infraBackground, "reveal infraBackgroundText must match display text");
    assert(revealed.infraBackgroundRaw && typeof revealed.infraBackgroundRaw === "object", "reveal must include raw camelCase infra object");
    assert(revealed.infra_background && typeof revealed.infra_background === "object", "reveal must include raw snake_case infra object");
    assert(revealed.progress?.percent === 100, "reveal must return complete RCA progress");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
  }

  assert(!stderr.includes("Startup failed"), `server startup failed unexpectedly; stdout=${stdout}; stderr=${stderr}`);
}

async function testScenarioScopeStartApi() {
  const appPort = await reserveLocalPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      RATE_LIMIT_MAX_REQUESTS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`, 5000);
    const scopesResponse = await fetch(`http://127.0.0.1:${appPort}/api/scenario-scopes`);
    const scopes = await scopesResponse.json();
    assert(scopesResponse.ok, `scenario scopes endpoint failed: HTTP ${scopesResponse.status}`);
    assert(scopes.scenarioScopes.some((scope) => scope.id === "solution-clarification" && scope.label === "方案澄清"), "scenario scopes API must expose solution clarification");

    const started = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, {
      difficulty: "medium",
      scenarioScope: "solution-clarification"
    });
    assert(started.scenario?.id === "medium-004", "medium solution-clarification scope must start the HA database clarification scenario");
    assert(started.scenario?.scenarioScope === "solution-clarification", "start response must include selected scenario scope");

    const missing = await postJsonAllowError(`http://127.0.0.1:${appPort}/api/game/start`, {
      difficulty: "easy",
      scenarioScope: "solution-clarification"
    });
    assert(missing.status === 404, `missing scope combination must return 404, got ${missing.status}`);
    assert(missing.body.error === "当前难度没有这个题库范围的题目", "missing scope response must explain no matching scenarios");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
  }

  assert(!stderr.includes("Startup failed"), `server startup failed unexpectedly; stdout=${stdout}; stderr=${stderr}`);
}

async function testSessionCapacityReturns503() {
  const appPort = await reserveLocalPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: "http://127.0.0.1:1/v1",
      OPENAI_MODEL: "test-model",
      MAX_ACTIVE_SESSIONS: "1",
      RATE_LIMIT_MAX_REQUESTS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`, 5000);
    const firstStart = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    const secondStart = await postJsonAllowError(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    assert(secondStart.status === 503, `session capacity overflow must return 503, got ${secondStart.status}`);
    assert(secondStart.body.error === "房间已满，请稍后再试", "503 response must explain session capacity limit");
    assert(secondStart.body.activeSessions === 1, "503 response must include activeSessions");
    assert(secondStart.body.maxActiveSessions === 1, "503 response must include maxActiveSessions");

    const closed = await postJson(`http://127.0.0.1:${appPort}/api/game/close`, { gameId: firstStart.gameId });
    assert(closed.ok === true && closed.closed === true, "close endpoint must confirm an active game was closed");
    const thirdStart = await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    assert(thirdStart.gameId, "close endpoint must release session capacity for a new game");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
  }

  assert(!stderr.includes("Startup failed"), `server startup failed unexpectedly; stdout=${stdout}; stderr=${stderr}`);
}

async function reserveLocalPort() {
  const holder = createTcpServer();
  await new Promise((resolve, reject) => {
    holder.once("error", reject);
    holder.listen(0, "127.0.0.1", resolve);
  });
  const address = holder.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => holder.close(resolve));
  return port;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${url} did not become ready`);
}

async function postJson(url, payload) {
  const result = await postJsonAllowError(url, payload);
  assert(result.response.ok, `${url} failed: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  assert(response.ok, `${url} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function getText(url) {
  const response = await fetch(url);
  const body = await response.text();
  assert(response.ok, `${url} failed: HTTP ${response.status} ${body}`);
  return body;
}

async function postJsonAllowError(url, payload, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
  const body = await response.json();
  return { response, status: response.status, body };
}

function runNodeWithEnv(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("server did not exit in time"));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function testDeploymentConfiguration() {
  const dockerfile = await readText("Dockerfile");
  const compose = await readText("docker-compose.yml");
  const systemd = await readText("deploy/systemd/ops-turtle-soup.service.example");
  const windowsScheduledTask = await readText("deploy/windows/install-scheduled-task.ps1");
  const loadLocal = await readText("tests/load-local.js");
  const llmSmoke = await readText("tests/llm-smoke.js");
  const loadLlm = await readText("tests/load-llm.js");
  const appSmoke = await readText("tests/app-smoke.js");
  const releaseRehearsal = await readText("tests/release-rehearsal.js");
  const buildRelease = await readText("tests/build-release.js");
  const verifyReleaseArchive = await readText("tests/verify-release-archive.js");
  const initReleaseRecord = await readText("tests/init-release-record.js");
  const checkReleaseRecord = await readText("tests/check-release-record.js");
  const releaseEvidence = await readText("tests/release-evidence.js");
  const processEvidence = await readText("tests/process-evidence.js");
  const coworkerSmoke = await readText("tests/coworker-access-smoke.js");
  const packageJson = await readText("package.json");
  const releaseChecklist = await readText("docs/runbook/release-checklist.md");
  const releaseRecordTemplate = await readText("docs/runbook/release-record-template.md");
  const uiSmoke = await readText("docs/runbook/ui-smoke.md");
  const scenarioIntake = await readText("docs/scenario-intake.md");

  assert(dockerfile.includes("HEALTHCHECK"), "Dockerfile must define a container healthcheck");
  assert(dockerfile.includes("/api/health"), "Docker healthcheck must probe /api/health");
  assert(dockerfile.includes("ARG RELEASE_GIT_COMMIT"), "Dockerfile must accept release git commit build arg");
  assert(dockerfile.includes("ENV RELEASE_GIT_COMMIT"), "Dockerfile must expose release git commit env");
  assert(compose.includes("restart: unless-stopped"), "docker-compose.yml must restart the service");
  assert(compose.includes("RELEASE_GIT_COMMIT"), "docker-compose.yml must pass release git commit build arg");
  assert(systemd.includes("Restart=always"), "systemd unit example must restart on failure");
  assert(systemd.includes("EnvironmentFile="), "systemd unit example must load .env");

  for (const token of [
    "New-ScheduledTaskAction",
    "New-ScheduledTaskTrigger -AtStartup",
    "Register-ScheduledTask",
    "Start-ScheduledTask",
    "npm",
    "logs",
    ".env"
  ]) {
    assert(windowsScheduledTask.includes(token), `Windows scheduled task script missing ${token}`);
  }

  for (const token of [
    "const initialMetrics = await getJson(\"/api/metrics\")",
    "const finalMetrics = await getJson(\"/api/metrics\")",
    "await getText(\"/metrics\")",
    "gameStartsTotal increased",
    "gameRevealsTotal increased",
    "prometheusMetrics"
  ]) {
    assert(loadLocal.includes(token), `load-local smoke missing ${token}`);
  }

  assert(packageJson.includes('"load:llm": "node tests/load-llm.js"'), "package.json missing load:llm script");
  assert(packageJson.includes('"rehearse:release": "node tests/release-rehearsal.js"'), "package.json missing rehearse:release script");
  assert(packageJson.includes('"build:release": "node tests/build-release.js"'), "package.json missing build:release script");
  assert(packageJson.includes('"verify:release-archive": "node tests/verify-release-archive.js"'), "package.json missing verify:release-archive script");
  assert(packageJson.includes('"init:release-record": "node tests/init-release-record.js"'), "package.json missing init:release-record script");
  assert(packageJson.includes('"check:release-record": "node tests/check-release-record.js"'), "package.json missing check:release-record script");
  assert(packageJson.includes('"evidence:release": "node tests/release-evidence.js"'), "package.json missing evidence:release script");
  assert(packageJson.includes('"evidence:process": "node tests/process-evidence.js"'), "package.json missing evidence:process script");
  assert(packageJson.includes('"smoke:coworker": "node tests/coworker-access-smoke.js"'), "package.json missing smoke:coworker script");

  for (const token of [
    "Compress-Archive",
    "RELEASE_MANIFEST.txt",
    "RELEASE_INFO.json",
    "releaseInfo",
    "gitCommit",
    "sha256Path",
    "sha256File",
    "\".env\"",
    "\"node_modules\"",
    "\"server.out.log\"",
    "\"server.err.log\"",
    "\"server.js\"",
    "\"public\"",
    "\"data\"",
    "\"docs\"",
    "\"deploy\""
  ]) {
    assert(buildRelease.includes(token), `build-release script missing ${token}`);
  }

  for (const token of [
    "release-record-template.md",
    "RELEASE_RECORD_PATH",
    "nonSecretConfigKeys",
    "OPENAI_MODEL",
    "resolveFromRoot",
    "rev-parse",
    "release record already exists",
    "writeFile"
  ]) {
    assert(initReleaseRecord.includes(token), `init release record script missing ${token}`);
  }

  for (const token of [
    "RELEASE_RECORD_PATH",
    "OPENAI_API_KEY",
    "LLM_API_KEY",
    "Release approved",
    "assertLineEquals",
    "assertAssignmentEquals",
    "assertAssignmentNotOneOf",
    "resolveFromRoot",
    "HOST",
    "0.0.0.0",
    "MAX_ACTIVE_SESSIONS",
    "processEvidence.longRunningEvidencePresent",
    "metricsDelta.llmFailuresTotal",
    "metricsDelta.llmFallbacksTotal",
    "live LLM ask-path load smoke",
    "LLM capacity confirmed for event",
    "Docker build verified on target host",
    "Rate limit tuned for shared proxy IPs",
    "release record not found",
    "still contains an unselected option",
    "still contains a placeholder",
    "appears to contain sensitive text"
  ]) {
    assert(checkReleaseRecord.includes(token), `check release record script missing ${token}`);
  }

  for (const token of [
    "RELEASE_EVIDENCE_BASE_URL",
    "build.version",
    "build.gitCommit",
    "/api/health",
    "/api/ready",
    "/api/metrics",
    "/metrics",
    "readyForCoworkerAccess",
    "maxActiveSessionsSufficient",
    "fallbacksTotal",
    "llmFallbacksTotal",
    "ops_turtle_soup_llm_requests_total"
  ]) {
    assert(releaseEvidence.includes(token), `release evidence script missing ${token}`);
  }

  for (const token of [
    "PROCESS_EVIDENCE_BASE_URL",
    "/api/health",
    "Get-NetTCPConnection",
    "docker",
    "systemctl",
    "Get-ScheduledTask",
    "longRunningEvidencePresent",
    "build.gitCommit"
  ]) {
    assert(processEvidence.includes(token), `process evidence script missing ${token}`);
  }

  for (const token of [
    "COWORKER_SMOKE_BASE_URL",
    "COWORKER_SMOKE_EXPECTED_GIT_COMMIT",
    "EXPECTED_RELEASE_GIT_COMMIT",
    "assertBuildIdentity",
    "build.gitCommit",
    "/api/health",
    "/api/ready",
    "/app.js",
    "/api/game/start",
    "/api/game/reveal",
    "homepageLoaded",
    "gameStarted",
    "revealComplete"
  ]) {
    assert(coworkerSmoke.includes(token), `coworker access smoke missing ${token}`);
  }

  for (const token of [
    "tcpProbe",
    "LLM_SMOKE_TCP_TIMEOUT_MS",
    "TCP connect",
    "describeFetchError",
    "chat/completions"
  ]) {
    assert(llmSmoke.includes(token), `llm-smoke missing ${token}`);
  }

  for (const token of [
    "APP_SMOKE_EXPECTED_GIT_COMMIT",
    "EXPECTED_RELEASE_GIT_COMMIT",
    "assertBuildIdentity",
    "build.gitCommit",
    "PASS build identity"
  ]) {
    assert(appSmoke.includes(token), `app smoke missing ${token}`);
  }

  for (const token of [
    "LLM_LOAD_USERS",
    "LLM_LOAD_CONCURRENCY",
    "LLM_LOAD_MAX_P95_MS",
    "llm.requestsTotal increased",
    "llm.failuresTotal increased",
    "llm.fallbacksTotal increased",
    "llmFallbacksTotal",
    "askLatency",
    "llmCountersPresent"
  ]) {
    assert(loadLlm.includes(token), `load-llm smoke missing ${token}`);
  }

  for (const token of [
    "REHEARSAL_RUN_LLM",
    "tests/start-loadtest-server.js",
    "release archive build",
    "release archive verification",
    "offline deployment preflight",
    "online deployment verification",
    "application smoke",
    "release evidence snapshot",
    "100-session local capacity smoke",
    "live LLM ask-path load smoke",
    "build:release",
    "verify:release-archive",
    "evidence:release",
    "load:llm",
    "release rehearsal summary"
  ]) {
    assert(releaseRehearsal.includes(token), `release rehearsal missing ${token}`);
  }

  for (const token of [
    "RELEASE_ARCHIVE_PATH",
    "sha256",
    "Expand-Archive",
    "RELEASE_MANIFEST.txt",
    "RELEASE_INFO.json",
    "requiredEntries",
    "forbiddenNames",
    "\".env\"",
    "\"node_modules\"",
    "archive must contain one top-level release directory",
    "archive contains forbidden paths"
  ]) {
    assert(verifyReleaseArchive.includes(token), `verify-release-archive script missing ${token}`);
  }

  for (const token of [
    "npm test",
    "npm run verify:release-archive",
    "npm run verify:deploy:offline",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run smoke:coworker",
    "EXPECTED_RELEASE_GIT_COMMIT",
    "npm run init:release-record",
    "npm run check:release-record",
    "npm run evidence:process",
    "npm run evidence:release",
    "npm run load:llm",
    "npm run rehearse:release",
    "UI Smoke Runbook",
    "Release Record Template",
    "check:release-record",
    "npm run load:local",
    "MAX_ACTIVE_SESSIONS=300",
    "GET /api/metrics",
    "GET /api/ready",
    "GET /metrics",
    "game counter deltas >= 100",
    "prometheusMetrics.gameCountersPresent=true",
    "docker compose ps",
    "Get-ScheduledTask -TaskName OpsTurtleSoup",
    "systemctl status ops-turtle-soup"
  ]) {
    assert(releaseChecklist.includes(token), `release checklist missing ${token}`);
  }

  for (const token of [
    "Git commit:",
    "npm run evidence:process",
    "processEvidence.longRunningEvidencePresent=",
    "npm run verify:release-archive",
    "docker compose ps",
    "Get-ScheduledTask -TaskName OpsTurtleSoup",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run smoke:coworker",
    "npm run evidence:release",
    "npm run load:llm",
    "npm run rehearse:release",
    "npm run load:local",
    "MAX_ACTIVE_SESSIONS=",
    "Coworker Access Check",
    "GET /api/metrics",
    "GET /api/ready",
    "GET /metrics",
    "build.version=",
    "build.gitCommit=",
    "build.releaseName=",
    "metricsDelta.gameStartsTotal=",
    "metricsDelta.gameRevealsTotal=",
    "metricsDelta.llmRequestsTotal=",
    "metricsDelta.llmFailuresTotal=",
    "metricsDelta.llmFallbacksTotal=",
    "askLatency.p95Ms=",
    "prometheusMetrics.gameCountersPresent=",
    "prometheusMetrics.llmCountersPresent=",
    "prometheus.ops_turtle_soup_http_requests_total",
    "prometheus.ops_turtle_soup_llm_fallbacks_total",
    "coworker smoke build.gitCommit",
    "Release approved"
  ]) {
    assert(releaseRecordTemplate.includes(token), `release record template missing ${token}`);
  }

  for (const token of [
    "question-bank selector",
    "`题库` appears to the left of `难度`",
    "Open `更新记录`",
    "基础设施：",
    "[object Object]",
    "庆祝",
    "已破案"
  ]) {
    assert(uiSmoke.includes(token), `UI smoke runbook missing ${token}`);
  }

  for (const token of [
    "data/scenarios/<difficulty>/<难度-编号-题目>.json",
    "每道题一个文件",
    "难度-编号-题目.json",
    "提取步骤",
    "质量检查",
    "npm test"
  ]) {
    assert(scenarioIntake.includes(token), `scenario intake doc missing ${token}`);
  }
}

function validReleaseRecord() {
  return [
    "# Release Record",
    "",
    "- Date: 2026-07-01T05:36:54.587Z",
    "- Operator: ops",
    "- Release host: ops-game-01",
    "- Host OS: linux x64; node 24.15.0",
    "- Deployment mode: systemd",
    "- Git commit: 81dd496",
    "- Expected player count: 100",
    "- Shared URL: http://10.0.0.10:5725/",
    "- LLM endpoint host, without key: internal-llm.example/v1",
    "- LLM model: internal-model-name",
    "",
    "HOST=0.0.0.0",
    "PORT=5725",
    "MAX_ACTIVE_SESSIONS=300",
    "LLM_MAX_CONCURRENCY=8",
    "LLM_QUEUE_LIMIT=100",
    "RATE_LIMIT_MAX_REQUESTS=120",
    "",
    "archivePath=dist/ops-turtle-soup.zip",
    "sha256Path=dist/ops-turtle-soup.zip.sha256",
    "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "releaseName=ops-turtle-soup-0.1.0-20260701T053641Z",
    ".env excluded=yes",
    "processEvidence.build.gitCommit=81dd496",
    "processEvidence.longRunningEvidencePresent=true",
    "processEvidence.port.listening=true",
    "processEvidence.managers.dockerCompose.active=false",
    "processEvidence.managers.systemd.active=true",
    "processEvidence.managers.windowsScheduledTask.active=false",
    "expected files present=yes",
    "forbidden paths absent=yes",
    "manifest checked=yes",
    "",
    "npm test",
    "npm run rehearse:release",
    "runLlm=true",
    "release archive build=pass",
    "release archive verification=pass",
    "offline deployment preflight=pass",
    "online deployment verification=pass",
    "application smoke=pass",
    "release evidence snapshot=pass",
    "100-session local capacity smoke=pass",
    "live LLM ask-path load smoke=pass",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run smoke:coworker",
    "npm run evidence:release",
    "npm run load:llm",
    "npm run load:local",
    "",
    "build.version=0.1.0",
    "build.gitCommit=81dd496",
    "build.releaseName=ops-turtle-soup-0.1.0-20260701T053641Z",
    "ready.ok=true",
    "ready.llm.apiKeyConfigured=true",
    "ready.llm.baseUrlConfigured=true",
    "ready.llm.modelConfigured=true",
    "ready.scenarioSets.easy=2",
    "ready.scenarioSets.medium=2",
    "ready.scenarioSets.hard=2",
    "ready.sessions.maxActive=300",
    "activeSessions=1",
    "gameStartsTotal=101",
    "gameQuestionsTotal=11",
    "gameRevealsTotal=101",
    "llm.requestsTotal=20",
    "llm.failuresTotal=0",
    "llm.fallbacksTotal=0",
    "",
    "completed=100",
    "askLatency.p95Ms=5518",
    "metricsDelta.gameQuestionsTotal=10",
    "metricsDelta.llmRequestsTotal=20",
    "metricsDelta.llmFailuresTotal=0",
    "metricsDelta.llmFallbacksTotal=0",
    "metricsDelta.gameStartsTotal=100",
    "metricsDelta.gameRevealsTotal=100",
    "prometheusMetrics.gameCountersPresent=true",
    "prometheusMetrics.llmCountersPresent=true",
    "prometheus.ops_turtle_soup_http_requests_total=present",
    "prometheus.ops_turtle_soup_llm_requests_total=present",
    "prometheus.ops_turtle_soup_llm_fallbacks_total=present",
    "",
    "## Browser UI Smoke",
    "- Browser machine: coworker-laptop",
    "- Browser: Chrome",
    "- Difficulty selection passed: yes",
    "- Question flow passed: yes",
    "- Chat collapse/expand passed: yes",
    "- Reveal formatting passed: yes",
    "- Solved celebration passed: yes",
    "",
    "## Coworker Access Check",
    "- Coworker machine or subnet: office-subnet",
    "- URL opened: http://10.0.0.10:5725/",
    "- Page loaded: yes",
    "- Game started: yes",
    "- One question answered: yes",
    "- `npm run smoke:coworker` passed: yes",
    "",
    "## Risks And Decisions",
    "- Docker build verified on target host: no",
    "- Browser UI smoke automated: no",
    "- Sessions are in memory and will be lost on restart: acknowledged yes",
    "- Single instance only, no horizontal scaling: acknowledged yes",
    "- Rate limit tuned for shared proxy IPs: not applicable",
    "- LLM capacity confirmed for event: yes",
    "Coworker Access Check",
    "Browser UI Smoke",
    "Risks And Decisions",
    "",
    "- Release approved: yes",
    "- Approval time: 2026-07-01T06:00:00.000Z",
    ""
  ].join("\n");
}

async function runReleaseRecordCheck(text) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ops-turtle-soup-record-"));
  const recordPath = path.join(tempDir, "release-record.md");
  await writeFile(recordPath, text, "utf8");

  try {
    return await runNodeScript(["tests/check-release-record.js"], { RELEASE_RECORD_PATH: recordPath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testReleaseRecordGateFailures() {
  const valid = validReleaseRecord();
  const validResult = await runReleaseRecordCheck(valid);
  assert(validResult.code === 0, `valid release record should pass; stderr=${validResult.stderr}`);

  const cases = [
    {
      name: "local host binding",
      text: valid.replace("HOST=0.0.0.0", "HOST=127.0.0.1"),
      expected: "HOST= must be 0.0.0.0"
    },
    {
      name: "capacity below target",
      text: valid.replace("MAX_ACTIVE_SESSIONS=300", "MAX_ACTIVE_SESSIONS=99"),
      expected: "MAX_ACTIVE_SESSIONS= must be >= 100"
    },
    {
      name: "live llm not run",
      text: valid.replace("runLlm=true", "runLlm=false"),
      expected: "runLlm= must be true"
    },
    {
      name: "llm failures",
      text: valid.replace("metricsDelta.llmFailuresTotal=0", "metricsDelta.llmFailuresTotal=1"),
      expected: "metricsDelta.llmFailuresTotal= must be 0"
    },
    {
      name: "llm fallbacks",
      text: valid.replace("metricsDelta.llmFallbacksTotal=0", "metricsDelta.llmFallbacksTotal=1"),
      expected: "metricsDelta.llmFallbacksTotal= must be 0"
    },
    {
      name: "coworker access not passed",
      text: valid.replace("- `npm run smoke:coworker` passed: yes", "- `npm run smoke:coworker` passed: no"),
      expected: "- `npm run smoke:coworker` passed: must be yes"
    },
    {
      name: "not approved",
      text: valid.replace("- Release approved: yes", "- Release approved: no"),
      expected: "- Release approved: must be yes"
    },
    {
      name: "unknown build commit",
      text: valid.replace("build.gitCommit=81dd496", "build.gitCommit=unknown"),
      expected: "build.gitCommit= must not be one of unknown"
    }
  ];

  for (const item of cases) {
    const result = await runReleaseRecordCheck(item.text);
    assert(result.code !== 0, `${item.name} should fail release record check`);
    assert(result.stderr.includes(item.expected), `${item.name} failure missing ${item.expected}; stderr=${result.stderr}`);
  }
}

function runNodeScript(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

await testScenarioSchema();
await testFrontendBindings();
await testRevealInfraFormatting();
await testServerConfiguration();
await testInvalidRuntimeConfiguration();
await testGracefulShutdown();
await testStartupPortConflict();
await testLlmQueueFullFallsBack();
await testLlmHttpFailureFallsBack();
await testSessionCapacityReturns503();
await testRevealApiInfraPayload();
await testScenarioScopeStartApi();
await testDeploymentConfiguration();
await testReleaseRecordGateFailures();

console.log("All tests passed");
