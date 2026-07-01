import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const recordPath = resolveFromRoot(process.env.RELEASE_RECORD_PATH || defaultRecordPath());
const failures = [];

function defaultRecordPath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join("docs", "runbook", `release-record-${day}.md`);
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(text, token, label) {
  if (!text.includes(token)) fail(`${label} missing ${token}`);
}

function lineValue(text, prefix) {
  const line = text.split(/\r?\n/).find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

function assertLineFilled(text, prefix) {
  const value = lineValue(text, prefix);
  if (!value) fail(`${prefix} is empty`);
  if (value.includes("|")) fail(`${prefix} still contains an unselected option`);
  if (value.includes("<") || value.includes(">")) fail(`${prefix} still contains a placeholder`);
}

function assertAssignmentFilled(text, key) {
  const value = lineValue(text, `${key}=`);
  if (!value) fail(`${key}= is empty`);
  if (value.includes("|")) fail(`${key}= still contains an unselected option`);
  if (value.includes("<") || value.includes(">")) fail(`${key}= still contains a placeholder`);
}

function assertLineEquals(text, prefix, expected) {
  const value = lineValue(text, prefix);
  if (value.toLowerCase() !== expected.toLowerCase()) {
    fail(`${prefix} must be ${expected}; got ${value || "empty"}`);
  }
}

function assertLineNumberAtLeast(text, prefix, minimum) {
  const value = Number(lineValue(text, prefix));
  if (!Number.isFinite(value) || value < minimum) {
    fail(`${prefix} must be >= ${minimum}; got ${lineValue(text, prefix) || "empty"}`);
  }
}

function assertAssignmentEquals(text, key, expected) {
  const value = lineValue(text, `${key}=`);
  if (value.toLowerCase() !== expected.toLowerCase()) {
    fail(`${key}= must be ${expected}; got ${value || "empty"}`);
  }
}

function assertAssignmentNumberAtLeast(text, key, minimum) {
  const value = Number(lineValue(text, `${key}=`));
  if (!Number.isFinite(value) || value < minimum) {
    fail(`${key}= must be >= ${minimum}; got ${lineValue(text, `${key}=`) || "empty"}`);
  }
}

function assertAssignmentOneOf(text, key, allowed) {
  const value = lineValue(text, `${key}=`).toLowerCase();
  if (!allowed.map((item) => item.toLowerCase()).includes(value)) {
    fail(`${key}= must be one of ${allowed.join(", ")}; got ${value || "empty"}`);
  }
}

function assertLineOneOf(text, prefix, allowed) {
  const value = lineValue(text, prefix).toLowerCase();
  if (!allowed.map((item) => item.toLowerCase()).includes(value)) {
    fail(`${prefix} must be one of ${allowed.join(", ")}; got ${value || "empty"}`);
  }
}

function assertNoSensitiveText(text) {
  const forbiddenPatterns = [
    /OPENAI_API_KEY\s*=/i,
    /LLM_API_KEY\s*=/i,
    /authorization:\s*bearer/i,
    /api[_-]?key["']?\s*[:=]\s*[^.\s]/i,
    /sk-[A-Za-z0-9_-]{12,}/
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) fail(`release record appears to contain sensitive text matching ${pattern}`);
  }
}

async function main() {
  if (!existsSync(recordPath)) {
    throw new Error(`release record not found: ${recordPath}`);
  }

  const text = await readFile(recordPath, "utf8");
  assertNoSensitiveText(text);

  for (const prefix of [
    "- Date:",
    "- Operator:",
    "- Release host:",
    "- Host OS:",
    "- Deployment mode:",
    "- Git commit:",
    "- Expected player count:",
    "- Shared URL:",
    "- LLM endpoint host, without key:",
    "- LLM model:",
    "- Release approved:",
    "- Approval time:"
  ]) {
    assertLineFilled(text, prefix);
  }

  for (const key of [
    "HOST",
    "PORT",
    "MAX_ACTIVE_SESSIONS",
    "LLM_MAX_CONCURRENCY",
    "LLM_QUEUE_LIMIT",
    "RATE_LIMIT_MAX_REQUESTS",
    "archivePath",
    "sha256Path",
    "sha256",
    "releaseName",
    "expected files present",
    "forbidden paths absent",
    "manifest checked",
    "runLlm",
    "release archive build",
    "release archive verification",
    "offline deployment preflight",
    "online deployment verification",
    "application smoke",
    "release evidence snapshot",
    "100-session local capacity smoke",
    "live LLM ask-path load smoke",
    "ready.ok",
    "ready.llm.apiKeyConfigured",
    "ready.llm.baseUrlConfigured",
    "ready.llm.modelConfigured",
    "ready.scenarioSets.easy",
    "ready.scenarioSets.medium",
    "ready.scenarioSets.hard",
    "ready.sessions.maxActive",
    "activeSessions",
    "gameStartsTotal",
    "gameRevealsTotal",
    "llm.requestsTotal",
    "llm.failuresTotal",
    "completed",
    "askLatency.p95Ms",
    "metricsDelta.gameQuestionsTotal",
    "metricsDelta.llmRequestsTotal",
    "metricsDelta.llmFailuresTotal",
    "metricsDelta.gameStartsTotal",
    "metricsDelta.gameRevealsTotal",
    "prometheusMetrics.gameCountersPresent",
    "prometheusMetrics.llmCountersPresent",
    "prometheus.ops_turtle_soup_http_requests_total",
    "prometheus.ops_turtle_soup_llm_requests_total"
  ]) {
    assertAssignmentFilled(text, key);
  }

  assertLineNumberAtLeast(text, "- Expected player count:", 100);
  assertLineEquals(text, "- Release approved:", "yes");

  assertAssignmentEquals(text, "HOST", "0.0.0.0");
  assertAssignmentNumberAtLeast(text, "MAX_ACTIVE_SESSIONS", 100);
  assertAssignmentEquals(text, ".env excluded", "yes");
  assertAssignmentEquals(text, "expected files present", "yes");
  assertAssignmentEquals(text, "forbidden paths absent", "yes");
  assertAssignmentEquals(text, "manifest checked", "yes");
  assertAssignmentEquals(text, "runLlm", "true");
  assertAssignmentEquals(text, "release archive build", "pass");
  assertAssignmentEquals(text, "release archive verification", "pass");
  assertAssignmentEquals(text, "offline deployment preflight", "pass");
  assertAssignmentEquals(text, "online deployment verification", "pass");
  assertAssignmentEquals(text, "application smoke", "pass");
  assertAssignmentEquals(text, "release evidence snapshot", "pass");
  assertAssignmentEquals(text, "100-session local capacity smoke", "pass");
  assertAssignmentEquals(text, "live LLM ask-path load smoke", "pass");
  assertAssignmentEquals(text, "ready.ok", "true");
  assertAssignmentEquals(text, "ready.llm.apiKeyConfigured", "true");
  assertAssignmentEquals(text, "ready.llm.baseUrlConfigured", "true");
  assertAssignmentEquals(text, "ready.llm.modelConfigured", "true");
  assertAssignmentNumberAtLeast(text, "ready.scenarioSets.easy", 1);
  assertAssignmentNumberAtLeast(text, "ready.scenarioSets.medium", 1);
  assertAssignmentNumberAtLeast(text, "ready.scenarioSets.hard", 1);
  assertAssignmentNumberAtLeast(text, "ready.sessions.maxActive", 100);
  assertAssignmentNumberAtLeast(text, "metricsDelta.gameQuestionsTotal", 1);
  assertAssignmentNumberAtLeast(text, "metricsDelta.llmRequestsTotal", 1);
  assertAssignmentEquals(text, "metricsDelta.llmFailuresTotal", "0");
  assertAssignmentNumberAtLeast(text, "metricsDelta.gameStartsTotal", 100);
  assertAssignmentNumberAtLeast(text, "metricsDelta.gameRevealsTotal", 100);
  assertAssignmentEquals(text, "prometheusMetrics.gameCountersPresent", "true");
  assertAssignmentEquals(text, "prometheusMetrics.llmCountersPresent", "true");
  assertAssignmentEquals(text, "prometheus.ops_turtle_soup_http_requests_total", "present");
  assertAssignmentEquals(text, "prometheus.ops_turtle_soup_llm_requests_total", "present");

  for (const prefix of [
    "- Difficulty selection passed:",
    "- Question flow passed:",
    "- Chat collapse/expand passed:",
    "- Reveal formatting passed:",
    "- Solved celebration passed:",
    "- Page loaded:",
    "- Game started:",
    "- One question answered:",
    "- `npm run smoke:coworker` passed:",
    "- Sessions are in memory and will be lost on restart: acknowledged",
    "- Single instance only, no horizontal scaling: acknowledged",
    "- LLM capacity confirmed for event:"
  ]) {
    assertLineEquals(text, prefix, "yes");
  }

  assertLineOneOf(text, "- Rate limit tuned for shared proxy IPs:", ["yes", "not applicable"]);

  const deploymentMode = lineValue(text, "- Deployment mode:");
  if (/docker/i.test(deploymentMode)) {
    assertLineEquals(text, "- Docker build verified on target host:", "yes");
  }

  for (const token of [
    "npm test",
    "npm run rehearse:release",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run smoke:coworker",
    "npm run evidence:release",
    "npm run load:llm",
    "npm run load:local",
    "Coworker Access Check",
    "Browser UI Smoke",
    "Risks And Decisions"
  ]) {
    assertIncludes(text, token, "release record");
  }

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    recordPath
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
