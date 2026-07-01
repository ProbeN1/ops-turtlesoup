import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const requiredEntries = [
  "RELEASE_MANIFEST.txt",
  "RELEASE_INFO.json",
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "package.json",
  "README.md",
  "server.js",
  "data",
  "deploy",
  "docs",
  "public",
  "tests"
];
const forbiddenNames = new Set([
  ".env",
  ".git",
  "node_modules",
  "server.out.log",
  "server.err.log",
  "dist"
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function latestArchive() {
  const distDir = path.join(root, "dist");
  const entries = await readdir(distDir, { withFileTypes: true });
  const archives = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".zip")) continue;
    const fullPath = path.join(distDir, entry.name);
    const info = await stat(fullPath);
    archives.push({ fullPath, mtimeMs: info.mtimeMs });
  }
  archives.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return archives[0]?.fullPath || "";
}

async function archivePath() {
  if (process.env.RELEASE_ARCHIVE_PATH) {
    return path.resolve(root, process.env.RELEASE_ARCHIVE_PATH);
  }
  return latestArchive();
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifyChecksum(filePath) {
  const checksumPath = `${filePath}.sha256`;
  assert(existsSync(checksumPath), `checksum file missing: ${checksumPath}`);
  const expected = (await readFile(checksumPath, "utf8")).trim().split(/\s+/)[0]?.toLowerCase();
  assert(/^[a-f0-9]{64}$/.test(expected), "checksum file must start with a SHA256 hex digest");
  const actual = await sha256File(filePath);
  assert(actual === expected, `SHA256 mismatch: expected ${expected}, got ${actual}`);
  return { checksumPath, sha256: actual };
}

async function extractArchive(filePath, targetDir) {
  if (process.platform === "win32") {
    await run("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${escapePowerShell(filePath)}' -DestinationPath '${escapePowerShell(targetDir)}' -Force`
    ]);
    return;
  }
  await run("unzip", ["-q", filePath, "-d", targetDir]);
}

function escapePowerShell(value) {
  return String(value).replace(/'/g, "''");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

async function singleExtractedRoot(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  assert(directories.length === 1, "archive must contain one top-level release directory");
  return path.join(targetDir, directories[0].name);
}

async function walk(relativeRoot, findings) {
  const entries = await readdir(relativeRoot, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(relativeRoot, entry.name);
    if (forbiddenNames.has(entry.name)) {
      findings.forbidden.push(fullPath);
    }
    if (entry.isDirectory()) {
      await walk(fullPath, findings);
    }
  }
}

async function verifyContents(extractedRoot) {
  for (const entry of requiredEntries) {
    assert(existsSync(path.join(extractedRoot, entry)), `archive missing ${entry}`);
  }

  const manifest = await readFile(path.join(extractedRoot, "RELEASE_MANIFEST.txt"), "utf8");
  for (const entry of requiredEntries.filter((item) => item !== "RELEASE_MANIFEST.txt")) {
    assert(manifest.includes(`- ${entry}`), `manifest missing included entry ${entry}`);
  }
  for (const entry of forbiddenNames) {
    assert(manifest.includes(`- ${entry}`), `manifest missing excluded entry ${entry}`);
  }

  const findings = { forbidden: [] };
  await walk(extractedRoot, findings);
  assert(findings.forbidden.length === 0, `archive contains forbidden paths: ${findings.forbidden.join(", ")}`);
}

async function main() {
  const filePath = await archivePath();
  assert(filePath, "release archive not found; run npm run build:release or set RELEASE_ARCHIVE_PATH");
  assert(existsSync(filePath), `release archive missing: ${filePath}`);
  const checksum = await verifyChecksum(filePath);
  const targetDir = await mkdtemp(path.join(os.tmpdir(), "ops-turtle-soup-release-"));

  try {
    await extractArchive(filePath, targetDir);
    const extractedRoot = await singleExtractedRoot(targetDir);
    await verifyContents(extractedRoot);
    console.log(JSON.stringify({
      ok: true,
      archivePath: filePath,
      sha256Path: checksum.checksumPath,
      sha256: checksum.sha256,
      extractedRoot
    }, null, 2));
  } finally {
    await rm(targetDir, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
