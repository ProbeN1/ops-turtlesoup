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

function numberEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) {
    fail(`${name} must be a number`);
    return fallback;
  }
  return value;
}

function localBaseUrl() {
  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const port = numberEnv("PORT", 5725);
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
  const port = numberEnv("PORT", 5725);
  const maxConcurrency = numberEnv("LLM_MAX_CONCURRENCY", 8);
  const queueLimit = numberEnv("LLM_QUEUE_LIMIT", 100);
  const rateLimitMax = numberEnv("RATE_LIMIT_MAX_REQUESTS", 120);
  const requestLimitBytes = numberEnv("REQUEST_LIMIT_BYTES", 64 * 1024);

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

  if (maxConcurrency > 0) pass("LLM_MAX_CONCURRENCY is positive");
  else fail("LLM_MAX_CONCURRENCY must be positive");

  if (queueLimit >= maxConcurrency) pass("LLM_QUEUE_LIMIT can absorb current concurrency");
  else warn("LLM_QUEUE_LIMIT is lower than LLM_MAX_CONCURRENCY");

  if (rateLimitMax >= 0) pass("RATE_LIMIT_MAX_REQUESTS is valid");
  else fail("RATE_LIMIT_MAX_REQUESTS must be zero or positive");

  if (requestLimitBytes >= 4096) pass("REQUEST_LIMIT_BYTES is large enough for game requests");
  else fail("REQUEST_LIMIT_BYTES is too small for normal game requests");
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

  for (const difficulty of ["easy", "medium", "hard"]) {
    if (!health.difficulties?.includes(difficulty)) {
      fail(`health endpoint missing ${difficulty} difficulty`);
    }
  }

  if (health.llm?.maxConcurrency > 0) pass("health endpoint exposes LLM limiter status");
  else fail("health endpoint missing LLM limiter status");

  const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
  if (!metricsResponse.ok) {
    fail(`metrics endpoint returned HTTP ${metricsResponse.status}`);
    return;
  }

  const metrics = await metricsResponse.json();
  if (typeof metrics.httpRequestsTotal === "number") pass("metrics endpoint exposes request counters");
  else fail("metrics endpoint missing request counters");

  if (typeof metrics.llm?.requestsTotal === "number") pass("metrics endpoint exposes LLM counters");
  else fail("metrics endpoint missing LLM counters");
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
