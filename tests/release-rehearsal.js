import { spawn } from "node:child_process";
import { createServer as createTcpServer } from "node:net";

const host = process.env.REHEARSAL_HOST || "127.0.0.1";
const requestedPort = process.env.REHEARSAL_PORT ? Number(process.env.REHEARSAL_PORT) : 0;
const runLlm = process.env.REHEARSAL_RUN_LLM === "1";
const startupTimeoutMs = Number(process.env.REHEARSAL_STARTUP_TIMEOUT_MS || 15000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function commandEnv(port) {
  const baseUrl = `http://${host}:${port}`;
  return {
    ...process.env,
    HOST: host,
    PORT: String(port),
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || "0",
    DEPLOY_VERIFY_BASE_URL: baseUrl,
    APP_SMOKE_BASE_URL: baseUrl,
    RELEASE_EVIDENCE_BASE_URL: baseUrl,
    LOAD_TEST_BASE_URL: baseUrl,
    LLM_LOAD_BASE_URL: baseUrl
  };
}

async function reservePort() {
  const holder = createTcpServer();
  await new Promise((resolve, reject) => {
    holder.once("error", reject);
    holder.listen(requestedPort, host, resolve);
  });
  const address = holder.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  await new Promise((resolve) => holder.close(resolve));
  return port;
}

function spawnNode(args, env, stdio = "pipe") {
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio
  });
}

async function waitForHealth(baseUrl, server) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep waiting until the startup deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server did not become healthy at ${baseUrl}`);
}

async function runCommand(label, command, args, env) {
  const startedAt = Date.now();
  const executable = command === "npm" && process.env.npm_execpath ? process.execPath : command;
  const commandArgs = command === "npm" && process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
  console.log(`\n== ${label} ==`);
  console.log(`${command} ${args.join(" ")}`);
  const child = spawn(executable, commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: "inherit"
  });

  const code = await new Promise((resolve) => child.on("close", resolve));
  const elapsedMs = Date.now() - startedAt;
  if (code !== 0) {
    throw new Error(`${label} failed with exit code ${code}`);
  }
  return { label, elapsedMs };
}

async function main() {
  assert(Number.isInteger(startupTimeoutMs) && startupTimeoutMs >= 1000, "REHEARSAL_STARTUP_TIMEOUT_MS must be >= 1000");
  if (process.env.REHEARSAL_PORT) {
    assert(Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65535, "REHEARSAL_PORT must be 1-65535");
  }

  const port = await reservePort();
  const env = commandEnv(port);
  const baseUrl = env.APP_SMOKE_BASE_URL;
  const steps = [];
  const server = spawnNode(["tests/start-loadtest-server.js"], env);

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    steps.push(await runCommand("release archive build", "npm", ["run", "build:release"], env));
    await waitForHealth(baseUrl, server);
    steps.push(await runCommand("offline deployment preflight", "npm", ["run", "verify:deploy:offline"], env));
    steps.push(await runCommand("online deployment verification", "npm", ["run", "verify:deploy"], env));
    steps.push(await runCommand("application smoke", "npm", ["run", "smoke:app"], env));
    steps.push(await runCommand("release evidence snapshot", "npm", ["run", "evidence:release"], env));
    steps.push(await runCommand("100-session local capacity smoke", "npm", ["run", "load:local"], env));
    if (runLlm) {
      steps.push(await runCommand("live LLM ask-path load smoke", "npm", ["run", "load:llm"], env));
    } else {
      console.log("\n== live LLM ask-path load smoke ==");
      console.log("SKIP set REHEARSAL_RUN_LLM=1 to run npm run load:llm during rehearsal");
    }

    console.log("\n== release rehearsal summary ==");
    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      runLlm,
      steps
    }, null, 2));
  } finally {
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => server.once("close", resolve));
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
