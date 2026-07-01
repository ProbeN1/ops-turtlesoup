import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const recordPath = path.join(root, process.env.RELEASE_RECORD_PATH || defaultRecordPath());
const failures = [];

function defaultRecordPath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join("docs", "runbook", `release-record-${day}.md`);
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
}

function assertAssignmentFilled(text, key) {
  const value = lineValue(text, `${key}=`);
  if (!value) fail(`${key}= is empty`);
  if (value.includes("|")) fail(`${key}= still contains an unselected option`);
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
    "ready.ok",
    "ready.sessions.maxActive",
    "activeSessions",
    "gameStartsTotal",
    "gameRevealsTotal",
    "llm.requestsTotal",
    "llm.failuresTotal",
    "completed",
    "metricsDelta.gameStartsTotal",
    "metricsDelta.gameRevealsTotal",
    "prometheus.ops_turtle_soup_http_requests_total",
    "prometheus.ops_turtle_soup_llm_requests_total"
  ]) {
    assertAssignmentFilled(text, key);
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
