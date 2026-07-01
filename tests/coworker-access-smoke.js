const baseUrl = requiredBaseUrl();
const timeoutMs = Number(process.env.COWORKER_SMOKE_TIMEOUT_MS || 15000);
const difficulty = process.env.COWORKER_SMOKE_DIFFICULTY || "easy";
const expectedGitCommit = process.env.COWORKER_SMOKE_EXPECTED_GIT_COMMIT || process.env.EXPECTED_RELEASE_GIT_COMMIT || "";

function requiredBaseUrl() {
  const value = process.env.COWORKER_SMOKE_BASE_URL || process.env.APP_SMOKE_BASE_URL || "";
  if (!value.trim()) {
    throw new Error("COWORKER_SMOKE_BASE_URL is required, for example http://<server-intranet-ip>:5725");
  }
  return value.replace(/\/$/, "");
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
  assert(response.ok, `${apiPath} failed: HTTP ${response.status}`);
  return data;
}

async function getText(apiPath) {
  const response = await fetchWithTimeout(`${baseUrl}${apiPath}`);
  const text = await response.text();
  assert(response.ok, `${apiPath} failed: HTTP ${response.status}`);
  return { response, text };
}

async function postJson(apiPath, payload) {
  const response = await fetchWithTimeout(`${baseUrl}${apiPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  assert(response.ok, `${apiPath} failed: HTTP ${response.status}`);
  return data;
}

async function main() {
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1000, "COWORKER_SMOKE_TIMEOUT_MS must be >= 1000");

  const health = await getJson("/api/health");
  assert(health.ok === true, "health endpoint did not report ok");
  assertBuildIdentity(health.build);
  assert(health.maxActiveSessions >= 100, "service capacity is below 100 active sessions");

  const readiness = await getJson("/api/ready");
  assert(readiness.ok === true, "readiness endpoint did not report ok");
  assert(readiness.sessions?.maxActive >= 100, "readiness reports insufficient session capacity");

  const page = await getText("/");
  assert(page.text.includes("/app.js"), "homepage missing app script");
  assert(page.text.includes("OPS TURTLE SOUP"), "homepage missing application shell");

  const app = await getText("/app.js?v=coworker-smoke");
  assert(app.text.includes("startGame"), "app.js missing startGame handler");
  assert(app.response.headers.get("cache-control") === "no-store", "app.js should be served with no-store cache-control");

  const start = await postJson("/api/game/start", { difficulty });
  assert(typeof start.gameId === "string" && start.gameId.length > 0, "start response missing gameId");
  assert(start.scenario?.difficulty === difficulty, "start response difficulty mismatch");
  assert(typeof start.scenario?.opening === "string" && start.scenario.opening.length > 20, "start response missing opening");

  const reveal = await postJson("/api/game/reveal", { gameId: start.gameId });
  assert(typeof reveal.hiddenTruth === "string" && reveal.hiddenTruth.length > 20, "reveal response missing hiddenTruth");
  assert(typeof reveal.infraBackgroundText === "string" && reveal.infraBackgroundText.length > 0, "reveal response missing infraBackgroundText");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    difficulty,
    healthOk: health.ok === true,
    build: health.build,
    readinessOk: readiness.ok === true,
    maxActiveSessions: health.maxActiveSessions,
    homepageLoaded: true,
    appScriptLoaded: true,
    cacheControl: app.response.headers.get("cache-control"),
    gameStarted: true,
    revealComplete: true
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
