import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(file) {
  return readFile(path.join(root, file), "utf8");
}

async function testScenarioSchema() {
  const seenIds = new Set();

  for (const [difficulty, file] of scenarioFiles) {
    const scenarios = JSON.parse(await readText(file));
    assert(Array.isArray(scenarios), `${file} must contain an array`);
    assert(scenarios.length >= 1, `${file} must contain at least one scenario`);

    for (const scenario of scenarios) {
      for (const field of requiredScenarioFields) {
        assert(field in scenario, `${scenario.id || file} missing ${field}`);
      }

      assert(scenario.difficulty === difficulty, `${scenario.id} difficulty must be ${difficulty}`);
      assert(!seenIds.has(scenario.id), `duplicate scenario id ${scenario.id}`);
      seenIds.add(scenario.id);
      assert(Array.isArray(scenario.tags), `${scenario.id} tags must be array`);
      assert(Array.isArray(scenario.must_discover), `${scenario.id} must_discover must be array`);
      assert(Array.isArray(scenario.question_rules.yes), `${scenario.id} question_rules.yes must be array`);
      assert(Array.isArray(scenario.question_rules.no), `${scenario.id} question_rules.no must be array`);
      assert(Array.isArray(scenario.question_rules.irrelevant), `${scenario.id} question_rules.irrelevant must be array`);
      assert(scenario.story.length > 20, `${scenario.id} story is too short`);
      assert(scenario.answer.length > 20, `${scenario.id} answer is too short`);
    }
  }
}

async function testFrontendBindings() {
  const html = await readText("public/index.html");
  const app = await readText("public/app.js");

  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const selectors = [...app.matchAll(/querySelector\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((selector) => selector.startsWith("#"))
    .map((selector) => selector.slice(1));

  for (const selector of selectors) {
    assert(ids.includes(selector), `public/app.js references missing #${selector}`);
  }

  assert(html.includes('value="easy"'), "frontend must use standard easy difficulty value");
  assert(app.includes("function formatInfraBackground"), "frontend must format infra background before rendering reveal");
  assert(!app.includes("基础设施：${data.infraBackground}"), "frontend must not render infra object directly");
}

async function testRevealInfraFormatting() {
  const app = await readText("public/app.js");
  const elements = new Map();

  function createElement() {
    return {
      textContent: "",
      disabled: false,
      innerHTML: "",
      className: "",
      children: [],
      classList: {
        contains: () => false,
        toggle: () => {},
        remove: () => {},
        add: () => {}
      },
      style: { setProperty: () => {} },
      addEventListener: () => {},
      append(...items) {
        this.children.push(...items);
        this.lastAppend = items;
      },
      focus: () => {},
      setAttribute: () => {},
      scrollTop: 0,
      scrollHeight: 0
    };
  }

  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, createElement());
      }
      return elements.get(selector);
    },
    createElement
  };

  const context = {
    document,
    window: { setTimeout: () => {} },
    requestAnimationFrame: (fn) => fn(),
    Math,
    fetch: () => {},
    console
  };

  vm.runInNewContext(app, context);
  context.renderReveal({
    infraBackground: {
      platform: "Proxmox",
      nodes: { workers: 2 },
      observability: ["Prometheus", "Grafana"]
    },
    hiddenTruth: "truth",
    solvePoints: ["point"],
    lesson: "lesson"
  });

  const chatLog = elements.get("#chatLog");
  const lastMessageBody = chatLog.children.at(-1).lastAppend[1].textContent;
  assert(!lastMessageBody.includes("[object Object]"), "reveal must not show [object Object]");
  assert(lastMessageBody.includes("platform: Proxmox"), "reveal must include formatted infra key/value");
  assert(lastMessageBody.includes("nodes: workers=2"), "reveal must include nested infra values");
}

async function testServerConfiguration() {
  const server = await readText("server.js");
  for (const token of [
    "LLM_MAX_CONCURRENCY",
    "LLM_QUEUE_LIMIT",
    "RATE_LIMIT_WINDOW_SECONDS",
    "RATE_LIMIT_MAX_REQUESTS",
    "GET\" && req.url === \"/api/metrics",
    "publicMetrics",
    "gameQuestionsTotal",
    "GET\" && req.url === \"/api/health"
  ]) {
    assert(server.includes(token), `server.js missing ${token}`);
  }
}

async function testDeploymentConfiguration() {
  const dockerfile = await readText("Dockerfile");
  const compose = await readText("docker-compose.yml");
  const systemd = await readText("deploy/systemd/ops-turtle-soup.service.example");
  const releaseChecklist = await readText("docs/runbook/release-checklist.md");

  assert(dockerfile.includes("HEALTHCHECK"), "Dockerfile must define a container healthcheck");
  assert(dockerfile.includes("/api/health"), "Docker healthcheck must probe /api/health");
  assert(compose.includes("restart: unless-stopped"), "docker-compose.yml must restart the service");
  assert(systemd.includes("Restart=always"), "systemd unit example must restart on failure");
  assert(systemd.includes("EnvironmentFile="), "systemd unit example must load .env");

  for (const token of [
    "npm test",
    "npm run verify:deploy:offline",
    "npm run verify:deploy",
    "npm run smoke:llm",
    "npm run smoke:app",
    "npm run load:local",
    "GET /api/metrics",
    "docker compose ps",
    "systemctl status ops-turtle-soup"
  ]) {
    assert(releaseChecklist.includes(token), `release checklist missing ${token}`);
  }
}

await testScenarioSchema();
await testFrontendBindings();
await testRevealInfraFormatting();
await testServerConfiguration();
await testDeploymentConfiguration();

console.log("All tests passed");
