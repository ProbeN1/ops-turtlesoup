import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const templatePath = path.join(root, "docs", "runbook", "release-record-template.md");
const outputPath = resolveFromRoot(process.env.RELEASE_RECORD_PATH || defaultRecordPath());
const nonSecretConfigKeys = [
  "HOST",
  "PORT",
  "SESSION_TTL_MINUTES",
  "MAX_ACTIVE_SESSIONS",
  "REQUEST_LIMIT_BYTES",
  "HTTP_REQUEST_TIMEOUT_SECONDS",
  "SHUTDOWN_GRACE_SECONDS",
  "LLM_MAX_CONCURRENCY",
  "LLM_QUEUE_LIMIT",
  "LLM_REQUEST_TIMEOUT_SECONDS",
  "RATE_LIMIT_WINDOW_SECONDS",
  "RATE_LIMIT_MAX_REQUESTS"
];

function defaultRecordPath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join("docs", "runbook", `release-record-${day}.md`);
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  const values = {};
  if (!existsSync(envPath)) return values;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function hostOs() {
  return `${process.platform} ${process.arch}; node ${process.versions.node}`;
}

function replaceLine(text, prefix, value) {
  return text.replace(new RegExp(`^${escapeRegExp(prefix)}.*$`, "m"), `${prefix}${value}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fillConfigBlock(text, envValues) {
  let result = text;
  for (const key of nonSecretConfigKeys) {
    result = result.replace(new RegExp(`^${key}=$`, "m"), `${key}=${envValues[key] || ""}`);
  }
  return result;
}

async function main() {
  if (existsSync(outputPath)) {
    throw new Error(`release record already exists: ${outputPath}`);
  }

  const envValues = loadEnvFile();
  const template = await readFile(templatePath, "utf8");
  const now = new Date().toISOString();
  let record = template;

  record = replaceLine(record, "- Date:", ` ${now}`);
  record = replaceLine(record, "- Host OS:", ` ${hostOs()}`);
  record = replaceLine(record, "- Git commit:", ` ${gitCommit()}`);
  record = replaceLine(record, "- Expected player count:", " 100");
  record = replaceLine(record, "- Shared URL:", envValues.HOST && envValues.PORT ? ` http://${envValues.HOST}:${envValues.PORT}/` : " ");
  record = replaceLine(record, "- LLM model:", envValues.OPENAI_MODEL || envValues.LLM_MODEL ? ` ${envValues.OPENAI_MODEL || envValues.LLM_MODEL}` : " ");
  record = fillConfigBlock(record, envValues);

  await writeFile(outputPath, record, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    ok: true,
    outputPath,
    gitCommit: gitCommit(),
    nonSecretConfigKeys
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
