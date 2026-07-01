import { readFile } from "node:fs/promises";
import path from "node:path";

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
}

async function testServerConfiguration() {
  const server = await readText("server.js");
  for (const token of [
    "LLM_MAX_CONCURRENCY",
    "LLM_QUEUE_LIMIT",
    "RATE_LIMIT_WINDOW_SECONDS",
    "RATE_LIMIT_MAX_REQUESTS",
    "GET\" && req.url === \"/api/health"
  ]) {
    assert(server.includes(token), `server.js missing ${token}`);
  }
}

await testScenarioSchema();
await testFrontendBindings();
await testServerConfiguration();

console.log("All tests passed");
