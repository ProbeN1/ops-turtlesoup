import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const timeoutMs = Number(process.env.PROCESS_EVIDENCE_TIMEOUT_MS || 15000);

loadEnvFile();

const baseUrl = processEvidenceBaseUrl();
const url = new URL(baseUrl);
const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));

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

function processEvidenceBaseUrl() {
  if (process.env.PROCESS_EVIDENCE_BASE_URL) return process.env.PROCESS_EVIDENCE_BASE_URL.replace(/\/$/, "");
  if (process.env.RELEASE_EVIDENCE_BASE_URL) return process.env.RELEASE_EVIDENCE_BASE_URL.replace(/\/$/, "");

  const host = process.env.HOST || "127.0.0.1";
  const probeHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return `http://${probeHost}:${process.env.PORT || "5725"}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeoutMs || 5000
  });

  return {
    available: result.error?.code !== "ENOENT",
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error?.message || ""
  };
}

async function fetchJson(apiPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${apiPath}`, { signal: controller.signal });
    const data = await response.json();
    assert(response.ok, `${apiPath} failed: HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeCommand(result, maxLength = 1200) {
  return {
    available: result.available,
    ok: result.ok,
    status: result.status,
    stdout: result.stdout.slice(0, maxLength),
    stderr: result.stderr.slice(0, maxLength),
    error: result.error
  };
}

function dockerEvidence() {
  const version = run("docker", ["compose", "version"]);
  if (!version.available) return { available: false };

  const ps = run("docker", ["compose", "ps"]);
  return {
    available: true,
    version: summarizeCommand(version),
    ps: summarizeCommand(ps),
    active: ps.ok && /ops-turtle-soup|running|up/i.test(ps.stdout)
  };
}

function systemdEvidence() {
  if (process.platform === "win32") return { available: false };

  const active = run("systemctl", ["is-active", "ops-turtle-soup"]);
  const status = run("systemctl", ["status", "ops-turtle-soup", "--no-pager"]);
  return {
    available: active.available || status.available,
    isActive: summarizeCommand(active),
    status: summarizeCommand(status),
    active: active.stdout.trim() === "active"
  };
}

function windowsScheduledTaskEvidence() {
  if (process.platform !== "win32") return { available: false };

  const task = run("powershell", [
    "-NoProfile",
    "-Command",
    "Get-ScheduledTask -TaskName OpsTurtleSoup -ErrorAction SilentlyContinue | Select-Object TaskName,State | ConvertTo-Json -Compress"
  ]);
  return {
    available: true,
    task: summarizeCommand(task),
    active: task.ok && /OpsTurtleSoup/i.test(task.stdout)
  };
}

function listeningPortEvidence() {
  if (process.platform === "win32") {
    const result = run("powershell", [
      "-NoProfile",
      "-Command",
      [
        `$items = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
        "$items | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress"
      ].join("; ")
    ]);
    return {
      available: true,
      command: summarizeCommand(result),
      listening: result.ok && result.stdout.length > 0
    };
  }

  const ss = run("ss", ["-ltnp"]);
  if (ss.available) {
    return {
      available: true,
      command: summarizeCommand(ss),
      listening: ss.ok && ss.stdout.includes(`:${port}`)
    };
  }

  const netstat = run("netstat", ["-ltnp"]);
  return {
    available: netstat.available,
    command: summarizeCommand(netstat),
    listening: netstat.ok && netstat.stdout.includes(`:${port}`)
  };
}

async function main() {
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1000, "PROCESS_EVIDENCE_TIMEOUT_MS must be >= 1000");

  const health = await fetchJson("/api/health");
  assert(health.ok === true, "health endpoint did not report ok");
  assert(health.build?.version, "health endpoint missing build.version");
  assert(health.build?.gitCommit, "health endpoint missing build.gitCommit");
  assert(health.maxActiveSessions >= 100, "health endpoint reports insufficient maxActiveSessions");

  const evidence = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    platform: {
      os: process.platform,
      arch: process.arch,
      node: process.versions.node
    },
    health: {
      ok: health.ok === true,
      build: health.build,
      uptimeSeconds: health.uptimeSeconds,
      activeSessions: health.activeSessions,
      maxActiveSessions: health.maxActiveSessions
    },
    port: listeningPortEvidence(),
    managers: {
      dockerCompose: dockerEvidence(),
      systemd: systemdEvidence(),
      windowsScheduledTask: windowsScheduledTaskEvidence()
    }
  };

  evidence.longRunningEvidencePresent = Boolean(
    evidence.port.listening ||
    evidence.managers.dockerCompose.active ||
    evidence.managers.systemd.active ||
    evidence.managers.windowsScheduledTask.active
  );

  assert(evidence.longRunningEvidencePresent, "no listening port or process manager evidence found");

  console.log(JSON.stringify(evidence, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
