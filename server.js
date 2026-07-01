import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnvFile();

const HOST = process.env.HOST || "127.0.0.1";
const PORT = readNumberEnv("PORT", 5725, { integer: true, min: 1, max: 65535 });
const REQUEST_LIMIT_BYTES = readNumberEnv("REQUEST_LIMIT_BYTES", 64 * 1024, { integer: true, min: 4096 });
const SESSION_TTL_MINUTES = readNumberEnv("SESSION_TTL_MINUTES", 120, { integer: true, min: 1 });
const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60 * 1000;
const MAX_ACTIVE_SESSIONS = readNumberEnv("MAX_ACTIVE_SESSIONS", 300, { integer: true, min: 1 });
const HTTP_REQUEST_TIMEOUT_SECONDS = readNumberEnv("HTTP_REQUEST_TIMEOUT_SECONDS", 60, { integer: true, min: 5 });
const SHUTDOWN_GRACE_SECONDS = readNumberEnv("SHUTDOWN_GRACE_SECONDS", 10, { integer: true, min: 1 });
const LLM_MAX_CONCURRENCY = readNumberEnv("LLM_MAX_CONCURRENCY", 8, { integer: true, min: 1 });
const LLM_QUEUE_LIMIT = readNumberEnv("LLM_QUEUE_LIMIT", 100, { integer: true, min: LLM_MAX_CONCURRENCY });
const LLM_REQUEST_TIMEOUT_SECONDS = readNumberEnv("LLM_REQUEST_TIMEOUT_SECONDS", 30, { integer: true, min: 1 });
const RATE_LIMIT_WINDOW_SECONDS = readNumberEnv("RATE_LIMIT_WINDOW_SECONDS", 60, { integer: true, min: 1 });
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;
const RATE_LIMIT_MAX_REQUESTS = readNumberEnv("RATE_LIMIT_MAX_REQUESTS", 120, { integer: true, min: 0 });
const SCENARIO_DIR = path.join(__dirname, "data", "scenarios");
const PUBLIC_DIR = path.join(__dirname, "public");
const BUILD_INFO = buildInfo();
const sessions = new Map();
const scenarioCache = new Map();
const rateLimitBuckets = new Map();
const llmLimiter = createLimiter(LLM_MAX_CONCURRENCY, LLM_QUEUE_LIMIT);
const metrics = createMetrics();

const difficulties = {
  easy: { label: "简单", directory: "easy", legacyFile: "easy.json" },
  medium: { label: "中等", directory: "medium", legacyFile: "medium.json" },
  hard: { label: "困难", directory: "hard", legacyFile: "hard.json" }
};

const difficultyAliases = {
  simple: "easy"
};

const allowedAnswersByDifficulty = {
  easy: ["是", "否", "无关"],
  medium: ["是", "否", "无关"],
  hard: ["是", "否", "无关"]
};

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

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    const value = match[2].replace(/^["']|["']$/g, "");
    process.env[match[1]] = value;
  }
}

function readJsonFile(relativePath, fallback = {}) {
  const filePath = path.join(__dirname, relativePath);
  if (!existsSync(filePath)) return fallback;

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: __dirname,
    encoding: "utf8",
    windowsHide: true
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function buildInfo() {
  const packageInfo = readJsonFile("package.json");
  const releaseInfo = readJsonFile("RELEASE_INFO.json");
  return {
    name: packageInfo.name || "ops-turtle-soup-game",
    version: packageInfo.version || "0.0.0",
    gitCommit: process.env.RELEASE_GIT_COMMIT || releaseInfo.gitCommit || gitCommit() || "unknown",
    releaseName: process.env.RELEASE_NAME || releaseInfo.releaseName || "",
    createdAt: releaseInfo.createdAt || ""
  };
}

function readNumberEnv(name, defaultValue, options = {}) {
  const raw = process.env[name] ?? String(defaultValue);
  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number; got ${JSON.stringify(raw)}`);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer; got ${JSON.stringify(raw)}`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${name} must be >= ${options.min}; got ${value}`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${name} must be <= ${options.max}; got ${value}`);
  }

  return value;
}

function normalizeDifficulty(difficulty) {
  const value = String(difficulty || "easy").trim();
  return difficultyAliases[value] || value;
}

async function loadScenarios(difficultyInput) {
  const difficulty = normalizeDifficulty(difficultyInput);
  if (scenarioCache.has(difficulty)) {
    return scenarioCache.get(difficulty);
  }

  const info = difficulties[difficulty];
  if (!info) throw new Error("Unknown difficulty");

  const scenarios = await readScenarioSet(info);
  if (!Array.isArray(scenarios) || !scenarios.length) {
    throw new Error(`No scenarios found for ${difficulty}`);
  }

  for (const scenario of scenarios) {
    validateScenario(scenario, difficulty);
  }

  scenarioCache.set(difficulty, scenarios);
  return scenarios;
}

async function readScenarioSet(info) {
  const directoryPath = path.join(SCENARIO_DIR, info.directory);
  if (existsSync(directoryPath)) {
    const files = (await readdir(directoryPath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    return Promise.all(files.map(async (file) => {
      const scenario = JSON.parse(await readFile(path.join(directoryPath, file), "utf8"));
      if (Array.isArray(scenario)) {
        throw new Error(`Scenario file ${path.join(info.directory, file)} must contain one scenario object`);
      }
      return scenario;
    }));
  }

  return JSON.parse(await readFile(path.join(SCENARIO_DIR, info.legacyFile), "utf8"));
}

function validateScenario(scenario, expectedDifficulty) {
  const missing = requiredScenarioFields.filter((field) => !(field in scenario));
  if (missing.length) {
    throw new Error(`Scenario ${scenario.id || "unknown"} missing fields: ${missing.join(", ")}`);
  }

  if (scenario.difficulty !== expectedDifficulty) {
    throw new Error(`Scenario ${scenario.id} has difficulty ${scenario.difficulty}, expected ${expectedDifficulty}`);
  }

  if (!scenario.question_rules || !Array.isArray(scenario.question_rules.yes) || !Array.isArray(scenario.question_rules.no) || !Array.isArray(scenario.question_rules.irrelevant)) {
    throw new Error(`Scenario ${scenario.id} has invalid question_rules`);
  }
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function jsonResponse(res, status, payload) {
  recordResponseStatus(status);
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function textResponse(res, status, body, contentType = "text/plain; charset=utf-8") {
  recordResponseStatus(status);
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

function createMetrics() {
  return {
    startedAt: new Date().toISOString(),
    httpRequestsTotal: 0,
    apiRequestsTotal: 0,
    staticRequestsTotal: 0,
    responsesByStatus: {},
    rateLimitedTotal: 0,
    errorsTotal: 0,
    gameStartsTotal: 0,
    gameQuestionsTotal: 0,
    gameRevealsTotal: 0,
    gamesSolvedTotal: 0,
    llm: {
      requestsTotal: 0,
      failuresTotal: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0
    }
  };
}

function incrementMetric(name) {
  metrics[name] += 1;
}

function recordResponseStatus(status) {
  const key = String(status);
  metrics.responsesByStatus[key] = (metrics.responsesByStatus[key] || 0) + 1;
}

function recordLlmResult(startedAt, response, error) {
  const latencyMs = Date.now() - startedAt;
  metrics.llm.lastLatencyMs = latencyMs;
  metrics.llm.totalLatencyMs += latencyMs;

  if (error || !response?.ok) {
    metrics.llm.failuresTotal += 1;
  }
}

function isLlmQueueFullError(error) {
  return error?.message === "LLM queue is full";
}

function publicMetrics() {
  const avgLlmLatencyMs = metrics.llm.requestsTotal
    ? Math.round(metrics.llm.totalLatencyMs / metrics.llm.requestsTotal)
    : 0;

  return {
    build: BUILD_INFO,
    startedAt: metrics.startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    httpRequestsTotal: metrics.httpRequestsTotal,
    apiRequestsTotal: metrics.apiRequestsTotal,
    staticRequestsTotal: metrics.staticRequestsTotal,
    responsesByStatus: metrics.responsesByStatus,
    rateLimitedTotal: metrics.rateLimitedTotal,
    errorsTotal: metrics.errorsTotal,
    activeSessions: sessions.size,
    maxActiveSessions: MAX_ACTIVE_SESSIONS,
    cachedScenarioSets: scenarioCache.size,
    gameStartsTotal: metrics.gameStartsTotal,
    gameQuestionsTotal: metrics.gameQuestionsTotal,
    gameRevealsTotal: metrics.gameRevealsTotal,
    gamesSolvedTotal: metrics.gamesSolvedTotal,
    llm: {
      ...llmLimiter.stats(),
      requestsTotal: metrics.llm.requestsTotal,
      failuresTotal: metrics.llm.failuresTotal,
      avgLatencyMs: avgLlmLatencyMs,
      lastLatencyMs: metrics.llm.lastLatencyMs
    },
    rateLimit: {
      windowSeconds: Math.round(RATE_LIMIT_WINDOW_MS / 1000),
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      trackedClients: rateLimitBuckets.size
    }
  };
}

async function readinessPayload() {
  const checks = [];
  const scenarioSets = {};

  const record = (name, ok, detail = {}) => {
    checks.push({ name, ok, ...detail });
  };

  const llmApiKeyConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
  const llmBaseUrlConfigured = Boolean(process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL);
  const llmModelConfigured = Boolean(process.env.OPENAI_MODEL || process.env.LLM_MODEL);
  record("llm-api-key", llmApiKeyConfigured);
  record("llm-base-url", llmBaseUrlConfigured);
  record("llm-model", llmModelConfigured);

  for (const difficulty of Object.keys(difficulties)) {
    try {
      const scenarios = await loadScenarios(difficulty);
      scenarioSets[difficulty] = scenarios.length;
      record(`scenarios-${difficulty}`, scenarios.length > 0, { count: scenarios.length });
    } catch (error) {
      scenarioSets[difficulty] = 0;
      record(`scenarios-${difficulty}`, false, { error: error.message });
    }
  }

  record("llm-limiter", LLM_MAX_CONCURRENCY >= 1 && LLM_QUEUE_LIMIT >= LLM_MAX_CONCURRENCY, {
    maxConcurrency: LLM_MAX_CONCURRENCY,
    queueLimit: LLM_QUEUE_LIMIT
  });
  record("rate-limit", RATE_LIMIT_WINDOW_SECONDS >= 1 && RATE_LIMIT_MAX_REQUESTS >= 0, {
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS
  });
  record("session-capacity", sessions.size < MAX_ACTIVE_SESSIONS, {
    activeSessions: sessions.size,
    maxActiveSessions: MAX_ACTIVE_SESSIONS
  });

  const ok = checks.every((check) => check.ok);
  return {
    ok,
    build: BUILD_INFO,
    checks,
    llm: {
      apiKeyConfigured: llmApiKeyConfigured,
      baseUrlConfigured: llmBaseUrlConfigured,
      modelConfigured: llmModelConfigured,
      requestTimeoutSeconds: LLM_REQUEST_TIMEOUT_SECONDS,
      ...llmLimiter.stats()
    },
    scenarioSets,
    sessions: {
      active: sessions.size,
      maxActive: MAX_ACTIVE_SESSIONS
    },
    rateLimit: {
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS
    }
  };
}

function prometheusMetrics() {
  const snapshot = publicMetrics();
  const lines = [];
  const metric = (name, type, help, samples) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    for (const sample of samples) {
      lines.push(sample);
    }
  };

  metric("ops_turtle_soup_uptime_seconds", "gauge", "Process uptime in seconds.", [
    `ops_turtle_soup_uptime_seconds ${snapshot.uptimeSeconds}`
  ]);
  metric("ops_turtle_soup_http_requests_total", "counter", "Total HTTP requests.", [
    `ops_turtle_soup_http_requests_total ${snapshot.httpRequestsTotal}`
  ]);
  metric("ops_turtle_soup_api_requests_total", "counter", "Total API requests.", [
    `ops_turtle_soup_api_requests_total ${snapshot.apiRequestsTotal}`
  ]);
  metric("ops_turtle_soup_static_requests_total", "counter", "Total static asset requests.", [
    `ops_turtle_soup_static_requests_total ${snapshot.staticRequestsTotal}`
  ]);
  metric("ops_turtle_soup_http_responses_total", "counter", "HTTP responses by status code.", [
    ...Object.entries(snapshot.responsesByStatus).map(([status, count]) => `ops_turtle_soup_http_responses_total{status="${status}"} ${count}`)
  ]);
  metric("ops_turtle_soup_errors_total", "counter", "Total unhandled application errors.", [
    `ops_turtle_soup_errors_total ${snapshot.errorsTotal}`
  ]);
  metric("ops_turtle_soup_rate_limited_total", "counter", "Total rate-limited API requests.", [
    `ops_turtle_soup_rate_limited_total ${snapshot.rateLimitedTotal}`
  ]);
  metric("ops_turtle_soup_active_sessions", "gauge", "Current active game sessions.", [
    `ops_turtle_soup_active_sessions ${snapshot.activeSessions}`
  ]);
  metric("ops_turtle_soup_max_active_sessions", "gauge", "Configured maximum active game sessions.", [
    `ops_turtle_soup_max_active_sessions ${snapshot.maxActiveSessions}`
  ]);
  metric("ops_turtle_soup_cached_scenario_sets", "gauge", "Scenario sets cached in memory.", [
    `ops_turtle_soup_cached_scenario_sets ${snapshot.cachedScenarioSets}`
  ]);
  metric("ops_turtle_soup_game_starts_total", "counter", "Total started games.", [
    `ops_turtle_soup_game_starts_total ${snapshot.gameStartsTotal}`
  ]);
  metric("ops_turtle_soup_game_questions_total", "counter", "Total player questions.", [
    `ops_turtle_soup_game_questions_total ${snapshot.gameQuestionsTotal}`
  ]);
  metric("ops_turtle_soup_game_reveals_total", "counter", "Total answer reveals.", [
    `ops_turtle_soup_game_reveals_total ${snapshot.gameRevealsTotal}`
  ]);
  metric("ops_turtle_soup_games_solved_total", "counter", "Total solved games.", [
    `ops_turtle_soup_games_solved_total ${snapshot.gamesSolvedTotal}`
  ]);
  metric("ops_turtle_soup_llm_requests_total", "counter", "Total LLM requests.", [
    `ops_turtle_soup_llm_requests_total ${snapshot.llm.requestsTotal}`
  ]);
  metric("ops_turtle_soup_llm_failures_total", "counter", "Total failed LLM requests.", [
    `ops_turtle_soup_llm_failures_total ${snapshot.llm.failuresTotal}`
  ]);
  metric("ops_turtle_soup_llm_active", "gauge", "Current active LLM requests.", [
    `ops_turtle_soup_llm_active ${snapshot.llm.active}`
  ]);
  metric("ops_turtle_soup_llm_queued", "gauge", "Current queued LLM requests.", [
    `ops_turtle_soup_llm_queued ${snapshot.llm.queued}`
  ]);
  metric("ops_turtle_soup_llm_max_concurrency", "gauge", "Configured LLM maximum concurrency.", [
    `ops_turtle_soup_llm_max_concurrency ${snapshot.llm.maxConcurrency}`
  ]);
  metric("ops_turtle_soup_llm_queue_limit", "gauge", "Configured LLM queue limit.", [
    `ops_turtle_soup_llm_queue_limit ${snapshot.llm.queueLimit}`
  ]);
  metric("ops_turtle_soup_llm_latency_ms", "gauge", "LLM latency in milliseconds.", [
    `ops_turtle_soup_llm_latency_ms{stat="average"} ${snapshot.llm.avgLatencyMs}`,
    `ops_turtle_soup_llm_latency_ms{stat="last"} ${snapshot.llm.lastLatencyMs}`
  ]);
  metric("ops_turtle_soup_rate_limit_window_seconds", "gauge", "Configured rate limit window in seconds.", [
    `ops_turtle_soup_rate_limit_window_seconds ${snapshot.rateLimit.windowSeconds}`
  ]);
  metric("ops_turtle_soup_rate_limit_max_requests", "gauge", "Configured maximum requests per rate limit window.", [
    `ops_turtle_soup_rate_limit_max_requests ${snapshot.rateLimit.maxRequests}`
  ]);
  metric("ops_turtle_soup_rate_limit_tracked_clients", "gauge", "Current clients tracked by the rate limiter.", [
    `ops_turtle_soup_rate_limit_tracked_clients ${snapshot.rateLimit.trackedClients}`
  ]);

  return `${lines.join("\n")}\n`;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  if (RATE_LIMIT_MAX_REQUESTS <= 0) return { allowed: true, remaining: Infinity };

  const now = Date.now();
  const key = clientIp(req);
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(key, bucket);
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count),
    resetAt: bucket.resetAt
  };
}

function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) {
      rateLimitBuckets.delete(key);
    }
  }
}

function createLimiter(maxConcurrency, queueLimit) {
  let active = 0;
  const queue = [];

  function runNext() {
    if (active >= maxConcurrency || queue.length === 0) return;

    const item = queue.shift();
    active += 1;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1;
        runNext();
      });
  }

  return {
    run(task) {
      if (active < maxConcurrency) {
        active += 1;
        return Promise.resolve()
          .then(task)
          .finally(() => {
            active -= 1;
            runNext();
          });
      }

      if (queue.length >= queueLimit) {
        return Promise.reject(new Error("LLM queue is full"));
      }

      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        runNext();
      });
    },
    stats() {
      return { active, queued: queue.length, maxConcurrency, queueLimit };
    }
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > REQUEST_LIMIT_BYTES) {
      throw new Error("Request body too large");
    }
  }

  if (!body) return {};
  return JSON.parse(body);
}

function publicScenario(scenario) {
  return {
    id: scenario.id,
    difficulty: scenario.difficulty,
    opening: scenario.story
  };
}

function revealPayload(scenario) {
  const infraBackgroundText = formatInfraBackground(scenario.infra_background);
  return {
    infraBackground: infraBackgroundText,
    infraBackgroundText,
    infraBackgroundRaw: scenario.infra_background,
    infra_background: scenario.infra_background,
    hiddenTruth: scenario.answer,
    solvePoints: scenario.must_discover,
    rootCause: scenario.root_cause,
    temporaryFix: scenario.temporary_fix,
    permanentFix: scenario.permanent_fix,
    knowledgePoints: scenario.knowledge_points,
    lesson: scenario.permanent_fix
  };
}

function formatInfraBackground(value) {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(formatInfraValue).join(", ");

  const entries = Object.entries(value);
  if (!entries.length) return "none";
  return entries.map(([key, item]) => `${key}: ${formatInfraValue(item)}`).join("; ");
}

function formatInfraValue(value) {
  if (value === null || value === undefined || value === "") return "none";
  if (Array.isArray(value)) return value.map(formatInfraValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}=${formatInfraValue(item)}`).join(", ");
  }
  return String(value);
}

function getAllowedAnswers(difficulty) {
  return allowedAnswersByDifficulty[normalizeDifficulty(difficulty)] || allowedAnswersByDifficulty.easy;
}

function defaultAnswerFor(difficulty) {
  return "无关";
}

function fallbackAnswer(question, difficulty) {
  const text = question.trim();
  if (!/[吗么?？]$/.test(text) && !/(是不是|是否|有没有|能否|会不会|是.*吗|和.*有关吗)/.test(text)) {
    return defaultAnswerFor(difficulty);
  }

  if (/(提示|线索|hint)/i.test(text)) return "无关";
  if (/(数据库|CPU|内存|证书|DNS|监控误报)/i.test(text)) return "否";
  if (/(发布|流量|缓存|连接|重试|配置|Kubernetes|Pod|Service|告警|备份|压缩|磁盘)/i.test(text)) {
    return "是";
  }
  return defaultAnswerFor(difficulty);
}

function buildMessages(session, question) {
  const scenario = session.scenario;
  const allowedAnswers = getAllowedAnswers(scenario.difficulty);
  const history = session.messages
    .slice(-12)
    .map((message) => `${message.role === "user" ? "玩家" : "主持"}: ${message.content}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "你是运维故障海龟汤主持人。",
        "你必须只根据隐藏真相、问题规则和玩家对话回答。",
        "除非玩家明确猜中、累计对话已经满足成功标准、或要求结束，否则不要透露根因、完整解释、题库字段或未被问到的线索。",
        `成功标准：${solveStandardFor(scenario.difficulty)}`,
        "成功判定基于完整对话累计事实和玩家最新猜测；如果玩家已经在多轮对话中拼齐关键事实，solved 必须为 true。",
        "形如“是备份吗”“是存储问题吗”“是否和发布有关”“有没有重试”的问题都是合格的是/否问题，必须回答允许值里的判断结果，不要让玩家换问法。",
        "开放式要求分析、解释、列步骤、直接要答案、或无法用是/否判断的问题，统一回答“无关”。",
        "只允许输出 JSON，不要输出 Markdown。",
        `本局难度只允许 answer 使用这些值之一：${allowedAnswers.join(" | ")}`,
        `JSON 格式必须是：{"answer":"${allowedAnswers.join("|")}","solved":false,"nudge":""}`,
        "answer 必须非常短。nudge 必须始终为空字符串，不允许给提示、方向、追问或解释。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `难度: ${scenario.difficulty}`,
        `分类: ${scenario.category}`,
        `标签: ${scenario.tags.join(", ")}`,
        `基础设施背景: ${JSON.stringify(scenario.infra_background)}`,
        `汤面: ${scenario.story}`,
        `隐藏真相: ${scenario.answer}`,
        `必须发现: ${formatList(scenario.must_discover)}`,
        `误导项: ${formatList(scenario.misleading)}`,
        `禁止提前透露: ${formatList(scenario.forbidden)}`,
        `回答规则-是: ${formatList(scenario.question_rules.yes)}`,
        `回答规则-否: ${formatList(scenario.question_rules.no)}`,
        `回答规则-无关: ${formatList(scenario.question_rules.irrelevant)}`,
        `推理路径: ${formatList(scenario.thinking_path)}`,
        `最近对话:\n${history || "无"}`,
        `玩家新问题: ${question}`
      ].join("\n")
    }
  ];
}

function solveStandardFor(difficulty) {
  const normalized = normalizeDifficulty(difficulty);
  if (normalized === "hard") {
    return "玩家必须说出端到端因果链，包含触发事件、放大机制、关键依赖/状态问题，以及为什么表面处置会延迟恢复。";
  }

  if (normalized === "medium") {
    return "玩家必须说出根因，并至少说明两个关键关联点，例如受影响范围、触发条件、误导表象或为什么回滚/扩容等处置表现异常。";
  }

  return "玩家必须说出核心根因，并覆盖至少一个关键定位点；只猜到现象、组件名或泛泛方向不算成功。";
}

function formatList(value) {
  if (Array.isArray(value)) return value.join("；");
  return value || "";
}

async function askLlm(session, question) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    const solved = assessSolvedLocally(session, question);
    return {
      answer: solved ? "是" : fallbackAnswer(question, session.scenario.difficulty),
      solved,
      nudge: ""
    };
  }

  const response = await limitedLlmFetch({
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: buildMessages(session, question)
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${responseText.slice(0, 240)}`);
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`LLM did not return JSON. Check OPENAI_BASE_URL; got ${response.headers.get("content-type") || "unknown content type"}`);
  }

  const data = JSON.parse(responseText);
  const content = data.choices?.[0]?.message?.content || "{}";
  const parsed = parseModelJson(content);
  const result = normalizeLlmAnswer(parsed, session.scenario.difficulty);
  if (!result.solved) {
    result.solved = await assessSolvedWithLlm(session, question);
  }
  if (result.solved) {
    result.answer = "是";
    result.nudge = "";
  }
  return result;
}

async function assessSolvedWithLlm(session, question) {
  if (assessSolvedLocally(session, question)) return true;

  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return false;

  const scenario = session.scenario;
  const conversation = [
    ...session.messages,
    { role: "user", content: question }
  ]
    .map((message) => `${message.role === "user" ? "玩家" : "主持"}: ${message.content}`)
    .join("\n");

  const response = await limitedLlmFetch({
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "你是海龟汤成功判定器，只输出 JSON。",
            "根据完整对话判断玩家是否已经累计说出谜底。",
            "不要因为主持已经提示过答案就自动判定成功；必须是玩家自己的发言已经覆盖成功标准。",
            `成功标准：${solveStandardFor(scenario.difficulty)}`,
            "输出格式：{\"solved\":true|false}"
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `难度: ${scenario.difficulty}`,
            `隐藏真相: ${scenario.answer}`,
            `必须发现: ${formatList(scenario.must_discover)}`,
            `完整对话:\n${conversation}`
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return false;
  }

  try {
    const data = JSON.parse(await response.text());
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = parseModelJson(content);
    return Boolean(parsed.solved);
  } catch {
    return assessSolvedLocally(session, question);
  }
}

function assessSolvedLocally(session, question) {
  const scenario = session.scenario;
  const playerText = [...session.messages, { role: "user", content: question }]
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");

  if (scenario.id === "easy-002") {
    const hasBackupCompression = /(备份|backup)/i.test(playerText) && /(压缩|压缩包|临时文件|压缩文件)/i.test(playerText);
    const hasLocation = /(\/data|同一分区|数据分区)/i.test(playerText);
    const hasUploadCleanup = /(上传完成|上传后|传完)/i.test(playerText) && /(删除|清理|自动删除|回落|恢复)/i.test(playerText);
    return hasUploadCleanup && (hasBackupCompression || hasLocation);
  }

  return false;
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function normalizeLlmAnswer(parsed, difficulty) {
  const allowed = new Set(getAllowedAnswers(difficulty));
  const rawAnswer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const answer = allowed.has(rawAnswer) ? rawAnswer : defaultAnswerFor(difficulty);
  return {
    answer,
    solved: Boolean(parsed.solved),
    nudge: ""
  };
}

function llmBaseUrl() {
  return (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

function llmModel() {
  return process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
}

function limitedLlmFetch(options) {
  metrics.llm.requestsTotal += 1;
  const startedAt = Date.now();
  return llmLimiter.run(() => fetchWithTimeout(`${llmBaseUrl()}/chat/completions`, options, LLM_REQUEST_TIMEOUT_SECONDS * 1000))
    .then((response) => {
      recordLlmResult(startedAt, response);
      return response;
    })
    .catch((error) => {
      recordLlmResult(startedAt, null, error);
      throw error;
    });
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanupSessions() {
  const now = Date.now();
  for (const [gameId, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(gameId);
    }
  }
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/health") {
    return jsonResponse(res, 200, {
      ok: true,
      build: BUILD_INFO,
      uptimeSeconds: Math.round(process.uptime()),
      activeSessions: sessions.size,
      maxActiveSessions: MAX_ACTIVE_SESSIONS,
      cachedScenarioSets: scenarioCache.size,
      llm: llmLimiter.stats(),
      rateLimit: {
        windowSeconds: Math.round(RATE_LIMIT_WINDOW_MS / 1000),
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
        trackedClients: rateLimitBuckets.size
      },
      difficulties: Object.keys(difficulties)
    });
  }

  if (req.method === "GET" && req.url === "/api/ready") {
    const readiness = await readinessPayload();
    return jsonResponse(res, readiness.ok ? 200 : 503, readiness);
  }

  if (req.method === "GET" && req.url === "/api/metrics") {
    return jsonResponse(res, 200, publicMetrics());
  }

  if (req.method === "GET" && req.url === "/api/difficulties") {
    return jsonResponse(res, 200, {
      difficulties: Object.entries(difficulties).map(([id, info]) => ({ id, label: info.label }))
    });
  }

  if (req.method === "POST" && req.url === "/api/game/start") {
    if (sessions.size >= MAX_ACTIVE_SESSIONS) {
      return jsonResponse(res, 503, {
        error: "房间已满，请稍后再试",
        detail: "active session limit reached",
        activeSessions: sessions.size,
        maxActiveSessions: MAX_ACTIVE_SESSIONS
      });
    }

    const body = await readJson(req);
    const difficulty = normalizeDifficulty(body.difficulty);
    const scenarios = await loadScenarios(difficulty);
    const scenario = pickRandom(scenarios);
    const gameId = crypto.randomUUID();

    sessions.set(gameId, {
      scenario,
      messages: [],
      solved: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    incrementMetric("gameStartsTotal");
    return jsonResponse(res, 200, { gameId, scenario: publicScenario(scenario) });
  }

  if (req.method === "POST" && req.url === "/api/game/ask") {
    const body = await readJson(req);
    const session = sessions.get(body.gameId);
    const question = String(body.question || "").trim();

    if (!session) return jsonResponse(res, 404, { error: "游戏不存在或已过期" });
    if (!question) return jsonResponse(res, 400, { error: "请输入问题" });

    incrementMetric("gameQuestionsTotal");
    const localSolved = assessSolvedLocally(session, question);
    const result = localSolved ? { answer: "是", solved: true, nudge: "" } : await askLlm(session, question);

    session.messages.push({ role: "user", content: question });
    session.messages.push({ role: "assistant", content: result.answer });
    session.updatedAt = Date.now();

    if (!result.solved && assessSolvedLocally(session, "")) {
      result.solved = true;
      result.answer = "是";
      result.nudge = "";
    }

    if (result.solved) {
      if (!session.solved) {
        incrementMetric("gamesSolvedTotal");
      }
      session.solved = true;
      result.reveal = revealPayload(session.scenario);
    }

    return jsonResponse(res, 200, result);
  }

  if (req.method === "POST" && req.url === "/api/game/reveal") {
    const body = await readJson(req);
    const session = sessions.get(body.gameId);
    if (!session) return jsonResponse(res, 404, { error: "游戏不存在或已过期" });

    session.updatedAt = Date.now();
    incrementMetric("gameRevealsTotal");
    return jsonResponse(res, 200, revealPayload(session.scenario));
  }

  return jsonResponse(res, 404, { error: "API not found" });
}

function handlePrometheusMetrics(req, res) {
  if (req.method !== "GET") {
    return textResponse(res, 405, "Method not allowed\n");
  }

  return textResponse(res, 200, prometheusMetrics(), "text/plain; version=0.0.4; charset=utf-8");
}

async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const safePath = requested === "/" ? "/index.html" : requested === "/feedback" ? "/feedback.html" : requested;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    recordResponseStatus(404);
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8"
  };

  const content = await readFile(filePath);
  recordResponseStatus(200);
  res.writeHead(200, {
    "content-type": contentTypes[ext] || "application/octet-stream",
    "cache-control": "no-store"
  });
  res.end(content);
}

const cleanupTimer = setInterval(cleanupSessions, Math.min(SESSION_TTL_MS, 10 * 60 * 1000));
cleanupTimer.unref?.();

const rateLimitCleanupTimer = setInterval(cleanupRateLimitBuckets, Math.min(RATE_LIMIT_WINDOW_MS, 60 * 1000));
rateLimitCleanupTimer.unref?.();

const server = createServer(async (req, res) => {
  metrics.httpRequestsTotal += 1;
  try {
    if (req.url?.startsWith("/api/")) {
      metrics.apiRequestsTotal += 1;
      const rateLimit = checkRateLimit(req);
      if (!rateLimit.allowed) {
        metrics.rateLimitedTotal += 1;
        return jsonResponse(res, 429, { error: "请求过于频繁，请稍后再试", resetAt: rateLimit.resetAt });
      }

      await handleApi(req, res);
      return;
    }

    if (req.url === "/metrics") {
      handlePrometheusMetrics(req, res);
      return;
    }

    metrics.staticRequestsTotal += 1;
    await serveStatic(req, res);
  } catch (error) {
    metrics.errorsTotal += 1;
    if (isLlmQueueFullError(error)) {
      return jsonResponse(res, 503, {
        error: "主持繁忙，请稍后再试",
        detail: "LLM queue is full"
      });
    }
    console.error(error);
    jsonResponse(res, 500, { error: error.message || "Internal server error" });
  }
});

server.requestTimeout = HTTP_REQUEST_TIMEOUT_SECONDS * 1000;
server.headersTimeout = Math.max(HTTP_REQUEST_TIMEOUT_SECONDS + 5, 10) * 1000;
server.keepAliveTimeout = Math.min(5000, server.requestTimeout);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Startup failed: ${HOST}:${PORT} is already in use. Stop the existing service or configure a different PORT.`);
  } else if (error.code === "EACCES") {
    console.error(`Startup failed: permission denied while binding ${HOST}:${PORT}. Use an allowed port or approved service account.`);
  } else {
    console.error("Startup failed:", error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : PORT;
  console.log(`Ops Turtle Soup running at http://${HOST}:${actualPort}`);
  if (process.env.SHUTDOWN_AFTER_START === "1") {
    setImmediate(() => shutdown("TEST"));
  }
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down`);
  clearInterval(cleanupTimer);
  clearInterval(rateLimitCleanupTimer);

  const forceTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, SHUTDOWN_GRACE_SECONDS * 1000);
  forceTimer.unref?.();

  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
