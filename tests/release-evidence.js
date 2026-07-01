import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const timeoutMs = Number(process.env.RELEASE_EVIDENCE_TIMEOUT_MS || 15000);

loadEnvFile();

const baseUrl = releaseEvidenceBaseUrl();

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function releaseEvidenceBaseUrl() {
  if (process.env.RELEASE_EVIDENCE_BASE_URL) {
    return process.env.RELEASE_EVIDENCE_BASE_URL.replace(/\/$/, "");
  }

  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const port = process.env.PORT || "5725";
  return `http://${probeHost}:${port}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
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
  return text;
}

function present(value) {
  return value ? "present" : "missing";
}

function buildEvidence(health, readiness, metrics, prometheusText) {
  return {
    capturedAt: new Date().toISOString(),
    baseUrl,
    build: health.build,
    health: {
      ok: health.ok === true,
      uptimeSeconds: health.uptimeSeconds,
      activeSessions: health.activeSessions,
      maxActiveSessions: health.maxActiveSessions,
      difficulties: health.difficulties
    },
    readiness: {
      ok: readiness.ok === true,
      llm: {
        apiKeyConfigured: readiness.llm?.apiKeyConfigured === true,
        baseUrlConfigured: readiness.llm?.baseUrlConfigured === true,
        modelConfigured: readiness.llm?.modelConfigured === true,
        requestTimeoutSeconds: readiness.llm?.requestTimeoutSeconds,
        maxConcurrency: readiness.llm?.maxConcurrency,
        queueLimit: readiness.llm?.queueLimit
      },
      scenarioSets: readiness.scenarioSets,
      sessions: readiness.sessions,
      rateLimit: readiness.rateLimit
    },
    runtime: {
      activeSessions: metrics.activeSessions,
      maxActiveSessions: metrics.maxActiveSessions,
      gameStartsTotal: metrics.gameStartsTotal,
      gameQuestionsTotal: metrics.gameQuestionsTotal,
      gameRevealsTotal: metrics.gameRevealsTotal,
      gamesSolvedTotal: metrics.gamesSolvedTotal,
      rateLimitedTotal: metrics.rateLimitedTotal,
      errorsTotal: metrics.errorsTotal,
      llm: {
        active: metrics.llm?.active,
        queued: metrics.llm?.queued,
        requestsTotal: metrics.llm?.requestsTotal,
        failuresTotal: metrics.llm?.failuresTotal,
        avgLatencyMs: metrics.llm?.avgLatencyMs,
        lastLatencyMs: metrics.llm?.lastLatencyMs
      }
    },
    prometheus: {
      httpRequestsTotal: present(prometheusText.includes("ops_turtle_soup_http_requests_total")),
      activeSessions: present(prometheusText.includes("ops_turtle_soup_active_sessions")),
      maxActiveSessions: present(prometheusText.includes("ops_turtle_soup_max_active_sessions")),
      gameStartsTotal: present(prometheusText.includes("ops_turtle_soup_game_starts_total")),
      llmRequestsTotal: present(prometheusText.includes("ops_turtle_soup_llm_requests_total")),
      llmFailuresTotal: present(prometheusText.includes("ops_turtle_soup_llm_failures_total"))
    },
    releaseProfile: {
      targetPlayers: 100,
      maxActiveSessionsSufficient: metrics.maxActiveSessions >= 100,
      readyForCoworkerAccess: readiness.ok === true && metrics.maxActiveSessions >= 100
    }
  };
}

async function main() {
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1000, "RELEASE_EVIDENCE_TIMEOUT_MS must be >= 1000");

  const health = await getJson("/api/health");
  const readiness = await getJson("/api/ready");
  const metrics = await getJson("/api/metrics");
  const prometheusText = await getText("/metrics");
  const evidence = buildEvidence(health, readiness, metrics, prometheusText);

  assert(evidence.health.ok, "health.ok must be true");
  assert(evidence.build?.version, "build.version must be present");
  assert(evidence.build?.gitCommit, "build.gitCommit must be present");
  assert(evidence.releaseProfile.maxActiveSessionsSufficient, "maxActiveSessions must be >= 100");
  assert(evidence.prometheus.httpRequestsTotal === "present", "Prometheus HTTP counter missing");
  assert(evidence.prometheus.llmRequestsTotal === "present", "Prometheus LLM counter missing");

  console.log(JSON.stringify(evidence, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
