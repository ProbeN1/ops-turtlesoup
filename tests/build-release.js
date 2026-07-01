import { mkdir, rm, cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const distDir = path.join(root, "dist");
const packageJson = await readJson("package.json");
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const releaseName = `ops-turtle-soup-${packageJson.version}-${timestamp}`;
const stagingDir = path.join(distDir, releaseName);
const archivePath = path.join(distDir, `${releaseName}.zip`);

const includePaths = [
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

const forbiddenPaths = [
  ".env",
  ".git",
  "node_modules",
  "server.out.log",
  "server.err.log",
  "dist"
];

async function readJson(relativePath) {
  const file = await import("node:fs/promises").then((fs) => fs.readFile(path.join(root, relativePath), "utf8"));
  return JSON.parse(file);
}

async function copyIncludedFiles() {
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });

  for (const relativePath of includePaths) {
    const source = path.join(root, relativePath);
    if (!existsSync(source)) {
      throw new Error(`release input missing: ${relativePath}`);
    }

    await cp(source, path.join(stagingDir, relativePath), {
      recursive: true,
      force: true,
      filter: (sourcePath) => !isForbidden(sourcePath)
    });
  }

  await writeFile(path.join(stagingDir, "RELEASE_MANIFEST.txt"), releaseManifest(), "utf8");
}

function isForbidden(sourcePath) {
  const relative = path.relative(root, sourcePath).replace(/\\/g, "/");
  return forbiddenPaths.some((forbidden) => relative === forbidden || relative.startsWith(`${forbidden}/`));
}

function releaseManifest() {
  return [
    `name=${releaseName}`,
    `version=${packageJson.version}`,
    `createdAt=${new Date().toISOString()}`,
    "",
    "included:",
    ...includePaths.map((item) => `- ${item}`),
    "",
    "excluded:",
    ...forbiddenPaths.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

async function createZip() {
  await rm(archivePath, { force: true });
  if (process.platform === "win32") {
    const command = `Compress-Archive -LiteralPath '${escapePowerShell(stagingDir)}' -DestinationPath '${escapePowerShell(archivePath)}' -Force`;
    await run("powershell", [
      "-NoProfile",
      "-Command",
      command
    ]);
    return;
  }

  await run("zip", ["-r", archivePath, releaseName], { cwd: distDir });
}

function escapePowerShell(value) {
  return String(value).replace(/'/g, "''");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

await copyIncludedFiles();
await createZip();

console.log(JSON.stringify({
  ok: true,
  releaseName,
  archivePath,
  stagingDir,
  included: includePaths,
  excluded: forbiddenPaths
}, null, 2));
