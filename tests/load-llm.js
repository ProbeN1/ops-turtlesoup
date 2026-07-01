import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedAnswersByDifficulty = {
  easy: new Set(["\u662f", "\u5426", "\u65e0\u5173"]),
  medium: new Set(["\u662f", "\u5426", "\u65e0\u5173"]),
  hard: new Set(["\u662f", "\u5426", "\u65e0\u5173"])
};

loadEnvFile();

const baseUrl = loadBaseUrl();
const totalUsers = numberEnv("LLM_LOAD_USERS", 10, { min: 1 });
const concurrency = numberEnv("LLM_LOAD_CONCURRENCY", 2, { min: 1 });
const difficulty = process.env.LLM_LOAD_DIFFICULTY || "easy";
const question = process.env.LLM_LOAD_QUESTION || "\u8fd9\u548c\u4e1a\u52a1\u6d41\u91cf\u66b4\u6da8\u6709\u5173\u5417\uff1f";
const timeoutMs = numberEnv("LLM_LOAD_TIMEOUT_MS", 60000, { min: 1000 });
const maxP95Ms = optionalNumberEnv("LLM_LOAD_MAX_P95_MS", { min: 1 });

if (!allowedAnswersByDifficulty[difficulty]) {
  throw new Error(`LLM_LOAD_DIFFICULTY must be one of ${Object.keys(allowedAnswersByDifficulty).join(", ")}`);
}

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

function loadBaseUrl() {
  if (process.env.LLM_LOAD_BASE_URL) return process.env.LLM_LOAD_BASE_URL.replace(/\/$/, "");
  if (process.env.APP_SMOKE_BASE_URL) return process.env.APP_SMOKE_BASE_URL.replace(/\/$/, "");

  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const port = process.env.PORT || "5725";
  return `http://${probeHost}:${port}`;
}

function numberEnv(name, fallback, { min }) {
  const raw = process.env[name] || String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

function optionalNumberEnv(name, { min }) {
  if (!process.env[name]) return null;
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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

async function runVirtualUser(index) {
  const start = await postJson("/api/game/start", { difficulty });
  assert(typeof start.gameId === "string" && start.gameId, "missing gameId");
  assert(start.scenario?.difficulty === difficulty, "start response difficulty mismatch");

  const startedAt = Date.now();
  const ask = await postJson("/api/game/ask", {
    gameId: start.gameId,
    question: `${question} #${index + 1}`
  });
  const askLatencyMs = Date.now() - startedAt;

  assert(allowedAnswersByDifficulty[difficulty].has(ask.answer), `answer is not allowed for ${difficulty}: ${JSON.stringify(ask.answer)}`);
  assert(typeof ask.solved === "boolean", "ask response solved must be boolean");
  assert((ask.nudge || "") === "", "ask response must not include host hints");

  return askLatencyMs;
}

function latencyStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    avgMs: Math.round(sum / sorted.length),
    p95Ms: sorted[p95Index],
    maxMs: sorted.at(-1)
  };
}

async function runPool() {
  const initialHealth = await getJson("/api/health");
  assert(initialHealth.ok === true, "health endpoint did not report ok");
  if (initialHealth.rateLimit?.maxRequests > 0 && initialHealth.rateLimit.maxRequests < totalUsers * 2) {
    console.warn("Tip: LLM load smoke may hit API rate limits. Raise RATE_LIMIT_MAX_REQUESTS for this trusted release check if needed.");
  }

  const initialMetrics = await getJson("/api/metrics");
  assert(typeof initialMetrics.llm?.requestsTotal === "number", "metrics endpoint missing LLM request counter");
  assert(typeof initialMetrics.llm?.failuresTotal === "number", "metrics endpoint missing LLM failure counter");

  const startedAt = Date.now();
  let next = 0;
  let completed = 0;
  const askLatencies = [];

  async function worker() {
    while (next < totalUsers) {
      const index = next;
      next += 1;
      askLatencies.push(await runVirtualUser(index));
      completed += 1;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalUsers) }, worker));
  const elapsedMs = Date.now() - startedAt;
  const finalMetrics = await getJson("/api/metrics");
  const prometheusMetrics = await getText("/metrics");
  const llmRequestsDelta = finalMetrics.llm.requestsTotal - initialMetrics.llm.requestsTotal;
  const llmFailuresDelta = finalMetrics.llm.failuresTotal - initialMetrics.llm.failuresTotal;
  const gameQuestionsDelta = finalMetrics.gameQuestionsTotal - initialMetrics.gameQuestionsTotal;
  const prometheusOk = prometheusMetrics.includes("ops_turtle_soup_llm_requests_total") &&
    prometheusMetrics.includes("ops_turtle_soup_llm_failures_total");
  const stats = latencyStats(askLatencies);

  assert(completed === totalUsers, `completed ${completed} of ${totalUsers} users`);
  assert(llmRequestsDelta >= totalUsers, `llm.requestsTotal increased by ${llmRequestsDelta}, expected at least ${totalUsers}`);
  assert(llmFailuresDelta === 0, `llm.failuresTotal increased by ${llmFailuresDelta}`);
  assert(gameQuestionsDelta >= totalUsers, `gameQuestionsTotal increased by ${gameQuestionsDelta}, expected at least ${totalUsers}`);
  assert(prometheusOk, "Prometheus metrics missing LLM counters");
  if (maxP95Ms !== null) {
    assert(stats.p95Ms <= maxP95Ms, `LLM ask p95 ${stats.p95Ms}ms exceeded ${maxP95Ms}ms`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    totalUsers,
    concurrency,
    difficulty,
    completed,
    elapsedMs,
    askLatency: stats,
    metricsDelta: {
      gameQuestionsTotal: gameQuestionsDelta,
      llmRequestsTotal: llmRequestsDelta,
      llmFailuresTotal: llmFailuresDelta,
      rateLimitedTotal: finalMetrics.rateLimitedTotal - initialMetrics.rateLimitedTotal
    },
    finalLlmLimiter: {
      active: finalMetrics.llm.active,
      queued: finalMetrics.llm.queued,
      avgLatencyMs: finalMetrics.llm.avgLatencyMs
    },
    prometheusMetrics: {
      llmCountersPresent: prometheusOk
    }
  }, null, 2));
}

await runPool();
