import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedAnswersByDifficulty = {
  easy: new Set(["是", "否", "无关"]),
  medium: new Set(["是", "否", "无关"]),
  hard: new Set(["是", "否", "无关"])
};

loadEnvFile();

const baseUrl = appSmokeBaseUrl();
const difficulty = process.env.APP_SMOKE_DIFFICULTY || "easy";
const question = process.env.APP_SMOKE_QUESTION || "这个问题和业务流量暴涨有关吗？";
const timeoutMs = Number(process.env.APP_SMOKE_TIMEOUT_MS || 30000);
const expectedGitCommit = process.env.APP_SMOKE_EXPECTED_GIT_COMMIT || process.env.EXPECTED_RELEASE_GIT_COMMIT || "";

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function appSmokeBaseUrl() {
  if (process.env.APP_SMOKE_BASE_URL) return process.env.APP_SMOKE_BASE_URL.replace(/\/$/, "");

  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const port = process.env.PORT || "5725";
  return `http://${probeHost}:${port}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertBuildIdentity(build) {
  assert(build && typeof build === "object", "health endpoint missing build identity");
  assert(typeof build.version === "string" && build.version.length > 0, "health endpoint missing build.version");
  assert(typeof build.gitCommit === "string" && build.gitCommit.length > 0, "health endpoint missing build.gitCommit");
  if (expectedGitCommit) {
    assert(build.gitCommit === expectedGitCommit, `build.gitCommit ${build.gitCommit} does not match expected ${expectedGitCommit}`);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(apiPath) {
  const response = await fetchWithTimeout(`${baseUrl}${apiPath}`);
  const data = await response.json();
  assert(response.ok, `${apiPath} failed: HTTP ${response.status} ${data.error || ""}`);
  return data;
}

async function getText(apiPath) {
  const response = await fetchWithTimeout(`${baseUrl}${apiPath}`);
  const text = await response.text();
  assert(response.ok, `${apiPath} failed: HTTP ${response.status} ${text}`);
  return text;
}

async function postJson(apiPath, payload) {
  const response = await fetchWithTimeout(`${baseUrl}${apiPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  assert(response.ok, `${apiPath} failed: HTTP ${response.status} ${data.error || ""}`);
  return data;
}

async function main() {
  const health = await getJson("/api/health");
  assert(health.ok === true, "health endpoint did not report ok");
  assertBuildIdentity(health.build);
  assert(Array.isArray(health.difficulties), "health endpoint missing difficulties");
  assert(health.difficulties.includes(difficulty), `health endpoint does not list ${difficulty}`);

  const readiness = await getJson("/api/ready");
  assert(readiness.ok === true, "readiness endpoint did not report ok");
  assert(readiness.llm?.apiKeyConfigured === true, "readiness endpoint missing LLM key configuration");
  assert(readiness.scenarioSets?.[difficulty] > 0, `readiness endpoint missing ${difficulty} scenarios`);

  const start = await postJson("/api/game/start", { difficulty });
  assert(typeof start.gameId === "string" && start.gameId.length > 0, "start response missing gameId");
  assert(start.scenario?.difficulty === difficulty, "start response difficulty mismatch");
  assert(typeof start.scenario?.opening === "string" && start.scenario.opening.length > 20, "start response missing opening");

  const ask = await postJson("/api/game/ask", {
    gameId: start.gameId,
    question
  });
  const allowedAnswers = allowedAnswersByDifficulty[difficulty];
  assert(allowedAnswers.has(ask.answer), `ask answer is not allowed for ${difficulty}: ${JSON.stringify(ask.answer)}`);
  assert(typeof ask.solved === "boolean", "ask response solved must be boolean");
  assert((ask.nudge || "") === "", "ask response must not include host hints");

  const reveal = await postJson("/api/game/reveal", { gameId: start.gameId });
  assert(typeof reveal.hiddenTruth === "string" && reveal.hiddenTruth.length > 20, "reveal response missing hiddenTruth");
  assert(typeof reveal.infraBackground === "string" && reveal.infraBackground.length > 0, "reveal response missing infraBackground text");
  assert(typeof reveal.infraBackgroundText === "string" && reveal.infraBackgroundText.length > 0, "reveal response missing infraBackgroundText");
  assert(Array.isArray(reveal.solvePoints) && reveal.solvePoints.length > 0, "reveal response missing solvePoints");
  assert(typeof reveal.lesson === "string" && reveal.lesson.length > 0, "reveal response missing lesson");

  const metrics = await getJson("/api/metrics");
  assert(metrics.gameStartsTotal >= 1, "metrics endpoint did not count game starts");
  assert(metrics.gameQuestionsTotal >= 1, "metrics endpoint did not count game questions");
  assert(metrics.gameRevealsTotal >= 1, "metrics endpoint did not count game reveals");
  assert(metrics.maxActiveSessions >= 100, "metrics endpoint reports insufficient maxActiveSessions");
  assert(typeof metrics.llm?.requestsTotal === "number", "metrics endpoint missing LLM request counter");

  const prometheusMetrics = await getText("/metrics");
  assert(prometheusMetrics.includes("ops_turtle_soup_game_starts_total"), "Prometheus metrics missing game start counter");
  assert(prometheusMetrics.includes("ops_turtle_soup_max_active_sessions"), "Prometheus metrics missing max active sessions gauge");
  assert(prometheusMetrics.includes("ops_turtle_soup_llm_requests_total"), "Prometheus metrics missing LLM request counter");

  console.log("PASS application health endpoint is reachable");
  console.log(`PASS build identity ${health.build.version} ${health.build.gitCommit}`);
  console.log("PASS application readiness endpoint reports deployable configuration");
  console.log(`PASS started ${difficulty} game ${start.gameId}`);
  console.log(`PASS ask path returned allowed answer: ${ask.answer}`);
  console.log("PASS reveal path returned complete answer payload");
  console.log("PASS metrics endpoint reported game counters");
  console.log("PASS Prometheus metrics endpoint reported game counters");
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
