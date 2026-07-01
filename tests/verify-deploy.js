import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const offline = process.argv.includes("--offline");
const results = [];

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

loadEnvFile();

function record(status, message) {
  results.push({ status, message });
}

function pass(message) {
  record("PASS", message);
}

function warn(message) {
  record("WARN", message);
}

function fail(message) {
  record("FAIL", message);
}

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function numberEnv(name, fallback, options = {}) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) {
    fail(`${name} must be a number`);
    return fallback;
  }

  if (options.integer && !Number.isInteger(value)) {
    fail(`${name} must be an integer`);
    return fallback;
  }

  if (options.min !== undefined && value < options.min) {
    fail(`${name} must be >= ${options.min}`);
    return fallback;
  }

  if (options.max !== undefined && value > options.max) {
    fail(`${name} must be <= ${options.max}`);
    return fallback;
  }

  return value;
}

function localBaseUrl() {
  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const port = numberEnv("PORT", 5725, { integer: true, min: 1, max: 65535 });
  return process.env.DEPLOY_VERIFY_BASE_URL || `http://${probeHost}:${port}`;
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) {
    pass(`Node.js ${process.versions.node} is supported`);
  } else {
    fail(`Node.js ${process.versions.node} is unsupported; use Node.js 18 or newer`);
  }
}

function checkConfig() {
  const host = process.env.HOST || "127.0.0.1";
  const port = numberEnv("PORT", 5725, { integer: true, min: 1, max: 65535 });
  const sessionTtlMinutes = numberEnv("SESSION_TTL_MINUTES", 120, { integer: true, min: 1 });
  const maxActiveSessions = numberEnv("MAX_ACTIVE_SESSIONS", 300, { integer: true, min: 1 });
  const maxConcurrency = numberEnv("LLM_MAX_CONCURRENCY", 8, { integer: true, min: 1 });
  const queueLimit = numberEnv("LLM_QUEUE_LIMIT", 100, { integer: true, min: maxConcurrency });
  const llmRequestTimeoutSeconds = numberEnv("LLM_REQUEST_TIMEOUT_SECONDS", 30, { integer: true, min: 1 });
  const rateLimitWindowSeconds = numberEnv("RATE_LIMIT_WINDOW_SECONDS", 60, { integer: true, min: 1 });
  const rateLimitMax = numberEnv("RATE_LIMIT_MAX_REQUESTS", 120, { integer: true, min: 0 });
  const requestLimitBytes = numberEnv("REQUEST_LIMIT_BYTES", 64 * 1024, { integer: true, min: 4096 });
  const requestTimeoutSeconds = numberEnv("HTTP_REQUEST_TIMEOUT_SECONDS", 60, { integer: true, min: 5 });
  const shutdownGraceSeconds = numberEnv("SHUTDOWN_GRACE_SECONDS", 10, { integer: true, min: 1 });

  if (port > 0 && port < 65536) pass("PORT is valid");
  else fail("PORT must be between 1 and 65535");

  if (host === "0.0.0.0") pass("HOST allows intranet access");
  else warn("HOST is not 0.0.0.0; coworkers may not reach this service from the intranet");

  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) pass("LLM API key is configured");
  else fail("OPENAI_API_KEY or LLM_API_KEY is required for full gameplay");

  if (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL) pass("LLM base URL is configured");
  else warn("LLM base URL is not configured; default OpenAI endpoint will be used");

  if (process.env.OPENAI_MODEL || process.env.LLM_MODEL) pass("LLM model is configured");
  else warn("LLM model is not configured; fallback model will be used");

  if (sessionTtlMinutes >= 1) pass("SESSION_TTL_MINUTES is valid");
  if (maxActiveSessions >= 100) pass("MAX_ACTIVE_SESSIONS can support the target player count");
  else fail("MAX_ACTIVE_SESSIONS must be >= 100 for the target release profile");
  if (maxConcurrency >= 1) pass("LLM_MAX_CONCURRENCY is valid");
  if (queueLimit >= maxConcurrency) pass("LLM_QUEUE_LIMIT can absorb current concurrency");
  if (llmRequestTimeoutSeconds >= 1) pass("LLM_REQUEST_TIMEOUT_SECONDS is valid");
  if (rateLimitWindowSeconds >= 1) pass("RATE_LIMIT_WINDOW_SECONDS is valid");
  if (rateLimitMax >= 0) pass("RATE_LIMIT_MAX_REQUESTS is valid");
  if (requestLimitBytes >= 4096) pass("REQUEST_LIMIT_BYTES is large enough for game requests");
  if (requestTimeoutSeconds >= 5) pass("HTTP_REQUEST_TIMEOUT_SECONDS is valid");
  if (shutdownGraceSeconds >= 1) pass("SHUTDOWN_GRACE_SECONDS is valid");
}

async function checkScenarios() {
  const seenIds = new Set();
  let count = 0;

  for (const [difficulty, file] of scenarioFiles) {
    const scenarios = JSON.parse(await readFile(path.join(root, file), "utf8"));
    if (!Array.isArray(scenarios) || !scenarios.length) {
      fail(`${file} must contain at least one scenario`);
      continue;
    }

    for (const scenario of scenarios) {
      count += 1;
      for (const field of requiredScenarioFields) {
        if (!(field in scenario)) fail(`${scenario.id || file} missing ${field}`);
      }

      if (scenario.difficulty !== difficulty) fail(`${scenario.id} difficulty must be ${difficulty}`);
      if (seenIds.has(scenario.id)) fail(`duplicate scenario id ${scenario.id}`);
      seenIds.add(scenario.id);

      if (!scenario.story || scenario.story.length < 20) fail(`${scenario.id} story is too short`);
      if (!scenario.infra_background || typeof scenario.infra_background !== "object") {
        fail(`${scenario.id} infra_background must be an object`);
      }
      if (!Array.isArray(scenario.must_discover) || !scenario.must_discover.length) {
        fail(`${scenario.id} must_discover must be a non-empty array`);
      }
    }
  }

  pass(`validated ${count} scenarios across ${scenarioFiles.length} difficulty files`);
}

async function checkHealth() {
  if (offline) {
    warn("health check skipped by --offline");
    return;
  }

  const baseUrl = localBaseUrl();
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) {
    fail(`health endpoint returned HTTP ${response.status}`);
    return;
  }

  const health = await response.json();
  if (health.ok === true) pass("health endpoint reports ok");
  else fail("health endpoint did not report ok");

  if (health.build?.version && health.build?.gitCommit) pass("health endpoint exposes build identity");
  else fail("health endpoint missing build identity");

  for (const difficulty of ["easy", "medium", "hard"]) {
    if (!health.difficulties?.includes(difficulty)) {
      fail(`health endpoint missing ${difficulty} difficulty`);
    }
  }

  if (health.llm?.maxConcurrency > 0) pass("health endpoint exposes LLM limiter status");
  else fail("health endpoint missing LLM limiter status");

  const readyResponse = await fetch(`${baseUrl}/api/ready`);
  if (!readyResponse.ok) {
    fail(`readiness endpoint returned HTTP ${readyResponse.status}`);
    return;
  }

  const readiness = await readyResponse.json();
  if (readiness.ok === true) pass("readiness endpoint reports ok");
  else fail("readiness endpoint did not report ok");

  if (readiness.build?.version && readiness.build?.gitCommit) pass("readiness endpoint exposes build identity");
  else fail("readiness endpoint missing build identity");

  if (readiness.llm?.apiKeyConfigured && readiness.llm?.baseUrlConfigured && readiness.llm?.modelConfigured) {
    pass("readiness endpoint confirms LLM configuration");
  } else {
    fail("readiness endpoint reports incomplete LLM configuration");
  }

  for (const difficulty of ["easy", "medium", "hard"]) {
    if (readiness.scenarioSets?.[difficulty] > 0) pass(`readiness endpoint confirms ${difficulty} scenarios`);
    else fail(`readiness endpoint missing ${difficulty} scenarios`);
  }

  if (readiness.sessions?.maxActive > 0) pass("readiness endpoint exposes session capacity");
  else fail("readiness endpoint missing session capacity");

  const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
  if (!metricsResponse.ok) {
    fail(`metrics endpoint returned HTTP ${metricsResponse.status}`);
    return;
  }

  const metrics = await metricsResponse.json();
  if (metrics.build?.version && metrics.build?.gitCommit) pass("metrics endpoint exposes build identity");
  else fail("metrics endpoint missing build identity");

  if (typeof metrics.httpRequestsTotal === "number") pass("metrics endpoint exposes request counters");
  else fail("metrics endpoint missing request counters");

  if (typeof metrics.llm?.requestsTotal === "number") pass("metrics endpoint exposes LLM counters");
  else fail("metrics endpoint missing LLM counters");

  const prometheusResponse = await fetch(`${baseUrl}/metrics`);
  if (!prometheusResponse.ok) {
    fail(`Prometheus metrics endpoint returned HTTP ${prometheusResponse.status}`);
    return;
  }

  const prometheusText = await prometheusResponse.text();
  if (prometheusText.includes("ops_turtle_soup_http_requests_total")) pass("Prometheus metrics expose request counters");
  else fail("Prometheus metrics missing request counters");

  if (prometheusText.includes("ops_turtle_soup_llm_requests_total")) pass("Prometheus metrics expose LLM counters");
  else fail("Prometheus metrics missing LLM counters");
}

async function main() {
  checkNodeVersion();
  checkConfig();
  await checkScenarios();

  try {
    await checkHealth();
  } catch (error) {
    fail(`health check failed: ${error.message}`);
  }

  for (const result of results) {
    console.log(`${result.status} ${result.message}`);
  }

  if (results.some((result) => result.status === "FAIL")) {
    process.exitCode = 1;
  }
}

await main();
