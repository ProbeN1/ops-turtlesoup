import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { createServer as createTcpServer } from "node:net";

const root = process.cwd();
const scenarioFiles = [
  ["easy", "data/scenarios/easy.json"],
  ["medium", "data/scenarios/medium.json"],
  ["hard", "data/scenarios/hard.json"]
];

const requiredScenarioFields = [
  "id",
  "title",
  "difficulty",
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(file) {
  return readFile(path.join(root, file), "utf8");
}

async function testScenarioSchema() {
  const seenIds = new Set();

  for (const [difficulty, file] of scenarioFiles) {
    const scenarios = JSON.parse(await readText(file));
    assert(Array.isArray(scenarios), `${file} must contain an array`);
    assert(scenarios.length >= 1, `${file} must contain at least one scenario`);

    for (const scenario of scenarios) {
      for (const field of requiredScenarioFields) {
        assert(field in scenario, `${scenario.id || file} missing ${field}`);
      }

      assert(scenario.difficulty === difficulty, `${scenario.id} difficulty must be ${difficulty}`);
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
  const app = await readText("public/app.js");

  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const selectors = [...app.matchAll(/querySelector\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((selector) => selector.startsWith("#"))
    .map((selector) => selector.slice(1));

  for (const selector of selectors) {
    assert(ids.includes(selector), `public/app.js references missing #${selector}`);
  }

  assert(html.includes('value="easy"'), "frontend must use standard easy difficulty value");
  assert(html.includes('/app.js?v=20260701-infra-format'), "frontend must version app.js after reveal formatting fixes");
  assert(app.includes("function formatInfraBackground"), "frontend must format infra background before rendering reveal");
  assert(!app.includes("基础设施：${data.infraBackground}"), "frontend must not render infra object directly");
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
    "GET\" && req.url === \"/api/health"
  ]) {
    assert(server.includes(token), `server.js missing ${token}`);
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

async function testLlmQueueFullReturns503() {
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
    assert(firstSettled.status === 503, `queue overflow must return 503, got ${firstSettled.status}`);
    assert(firstSettled.body.error === "主持繁忙，请稍后再试", "503 response must explain host backpressure");
    assert(firstSettled.body.detail === "LLM queue is full", "503 response must include queue-full detail");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
    await new Promise((resolve) => blocker.close(resolve));
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
    await postJson(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    const secondStart = await postJsonAllowError(`http://127.0.0.1:${appPort}/api/game/start`, { difficulty: "easy" });
    assert(secondStart.status === 503, `session capacity overflow must return 503, got ${secondStart.status}`);
    assert(secondStart.body.error === "房间已满，请稍后再试", "503 response must explain session capacity limit");
    assert(secondStart.body.activeSessions === 1, "503 response must include activeSessions");
    assert(secondStart.body.maxActiveSessions === 1, "503 response must include maxActiveSessions");
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
  const loadLlm = await readText("tests/load-llm.js");
  const releaseRehearsal = await readText("tests/release-rehearsal.js");
  const buildRelease = await readText("tests/build-release.js");
  const releaseEvidence = await readText("tests/release-evidence.js");
  const coworkerSmoke = await readText("tests/coworker-access-smoke.js");
  const packageJson = await readText("package.json");
  const releaseChecklist = await readText("docs/runbook/release-checklist.md");
  const releaseRecordTemplate = await readText("docs/runbook/release-record-template.md");
  const uiSmoke = await readText("docs/runbook/ui-smoke.md");

  assert(dockerfile.includes("HEALTHCHECK"), "Dockerfile must define a container healthcheck");
  assert(dockerfile.includes("/api/health"), "Docker healthcheck must probe /api/health");
  assert(compose.includes("restart: unless-stopped"), "docker-compose.yml must restart the service");
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
  assert(packageJson.includes('"evidence:release": "node tests/release-evidence.js"'), "package.json missing evidence:release script");
  assert(packageJson.includes('"smoke:coworker": "node tests/coworker-access-smoke.js"'), "package.json missing smoke:coworker script");

  for (const token of [
    "Compress-Archive",
    "RELEASE_MANIFEST.txt",
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
    "RELEASE_EVIDENCE_BASE_URL",
    "/api/health",
    "/api/ready",
    "/api/metrics",
    "/metrics",
    "readyForCoworkerAccess",
    "maxActiveSessionsSufficient",
    "ops_turtle_soup_llm_requests_total"
  ]) {
    assert(releaseEvidence.includes(token), `release evidence script missing ${token}`);
  }

  for (const token of [
    "COWORKER_SMOKE_BASE_URL",
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
    "LLM_LOAD_USERS",
    "LLM_LOAD_CONCURRENCY",
    "LLM_LOAD_MAX_P95_MS",
    "llm.requestsTotal increased",
    "llm.failuresTotal increased",
    "askLatency",
    "llmCountersPresent"
  ]) {
    assert(loadLlm.includes(token), `load-llm smoke missing ${token}`);
  }

  for (const token of [
    "REHEARSAL_RUN_LLM",
    "tests/start-loadtest-server.js",
    "release archive build",
    "offline deployment preflight",
    "online deployment verification",
    "application smoke",
    "release evidence snapshot",
    "100-session local capacity smoke",
    "live LLM ask-path load smoke",
    "build:release",
    "evidence:release",
    "load:llm",
    "release rehearsal summary"
  ]) {
    assert(releaseRehearsal.includes(token), `release rehearsal missing ${token}`);
  }

  for (const token of [
    "npm test",
    "npm run verify:deploy:offline",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run smoke:coworker",
    "npm run evidence:release",
    "npm run load:llm",
    "npm run rehearse:release",
    "UI Smoke Runbook",
    "Release Record Template",
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
    "metricsDelta.gameStartsTotal=",
    "metricsDelta.gameRevealsTotal=",
    "metricsDelta.llmRequestsTotal=",
    "metricsDelta.llmFailuresTotal=",
    "askLatency.p95Ms=",
    "prometheusMetrics.gameCountersPresent=",
    "prometheusMetrics.llmCountersPresent=",
    "prometheus.ops_turtle_soup_http_requests_total",
    "Release approved"
  ]) {
    assert(releaseRecordTemplate.includes(token), `release record template missing ${token}`);
  }

  for (const token of [
    "选择 `中等`",
    "收起对话",
    "基础设施：",
    "[object Object]",
    "庆祝",
    "已破案"
  ]) {
    assert(uiSmoke.includes(token), `UI smoke runbook missing ${token}`);
  }
}

await testScenarioSchema();
await testFrontendBindings();
await testRevealInfraFormatting();
await testServerConfiguration();
await testInvalidRuntimeConfiguration();
await testGracefulShutdown();
await testStartupPortConflict();
await testLlmQueueFullReturns503();
await testSessionCapacityReturns503();
await testDeploymentConfiguration();

console.log("All tests passed");
