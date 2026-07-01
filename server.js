import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadEnvFile();

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5725);
const REQUEST_LIMIT_BYTES = Number(process.env.REQUEST_LIMIT_BYTES || 64 * 1024);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MINUTES || 120) * 60 * 1000;
const SCENARIO_DIR = path.join(__dirname, "data", "scenarios");
const PUBLIC_DIR = path.join(__dirname, "public");
const sessions = new Map();

const difficulties = {
  easy: { label: "简单", file: "easy.json" },
  medium: { label: "中等", file: "medium.json" },
  hard: { label: "困难", file: "hard.json" }
};

const difficultyAliases = {
  simple: "easy"
};

const allowedAnswersByDifficulty = {
  easy: ["是", "否", "无关", "请换一种问法", "是，但不完整", "否，但不完整"],
  medium: ["是", "否", "无关", "请换一种问法"],
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

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    const value = match[2].replace(/^["']|["']$/g, "");
    process.env[match[1]] = value;
  }
}

function normalizeDifficulty(difficulty) {
  const value = String(difficulty || "easy").trim();
  return difficultyAliases[value] || value;
}

async function loadScenarios(difficultyInput) {
  const difficulty = normalizeDifficulty(difficultyInput);
  const info = difficulties[difficulty];
  if (!info) throw new Error("Unknown difficulty");

  const scenarios = JSON.parse(await readFile(path.join(SCENARIO_DIR, info.file), "utf8"));
  if (!Array.isArray(scenarios) || !scenarios.length) {
    throw new Error(`No scenarios found for ${difficulty}`);
  }

  for (const scenario of scenarios) {
    validateScenario(scenario, difficulty);
  }

  return scenarios;
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
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
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
  return {
    infraBackground: scenario.infra_background,
    hiddenTruth: scenario.answer,
    solvePoints: scenario.must_discover,
    rootCause: scenario.root_cause,
    temporaryFix: scenario.temporary_fix,
    permanentFix: scenario.permanent_fix,
    knowledgePoints: scenario.knowledge_points,
    lesson: scenario.permanent_fix
  };
}

function getAllowedAnswers(difficulty) {
  return allowedAnswersByDifficulty[normalizeDifficulty(difficulty)] || allowedAnswersByDifficulty.easy;
}

function defaultAnswerFor(difficulty) {
  return getAllowedAnswers(difficulty).includes("请换一种问法") ? "请换一种问法" : "无关";
}

function fallbackAnswer(question, difficulty) {
  const text = question.trim();
  const allowed = getAllowedAnswers(difficulty);
  if (!/[吗么?？]$/.test(text) && !/(是不是|是否|有没有|能否|会不会|是.*吗|和.*有关吗)/.test(text)) {
    return defaultAnswerFor(difficulty);
  }

  if (/(提示|线索|hint)/i.test(text)) return "无关";
  if (/(数据库|CPU|内存|证书|DNS|监控误报)/i.test(text)) return "否";
  if (/(发布|流量|缓存|连接|重试|配置|Kubernetes|Pod|Service|告警|备份|压缩|磁盘)/i.test(text)) {
    return allowed.includes("是，但不完整") ? "是，但不完整" : "是";
  }
  return allowed.includes("无关") ? "无关" : defaultAnswerFor(difficulty);
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
        "只有开放式要求分析、解释、列步骤、直接要答案、或无法用是/否判断的问题，才回答“请换一种问法”。",
        "只允许输出 JSON，不要输出 Markdown。",
        `本局难度只允许 answer 使用这些值之一：${allowedAnswers.join(" | ")}`,
        `JSON 格式必须是：{"answer":"${allowedAnswers.join("|")}","solved":false,"nudge":""}`,
        "answer 必须非常短。nudge 只能在玩家明显卡住时给一句很短的方向，否则为空字符串。"
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
      nudge: solved ? "" : "当前未配置 LLM Key，这是本地演示回答。"
    };
  }

  const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
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

  const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
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
    nudge: typeof parsed.nudge === "string" ? parsed.nudge.slice(0, 80) : ""
  };
}

function llmBaseUrl() {
  return (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

function llmModel() {
  return process.env.OPENAI_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";
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
      uptimeSeconds: Math.round(process.uptime()),
      activeSessions: sessions.size,
      difficulties: Object.keys(difficulties)
    });
  }

  if (req.method === "GET" && req.url === "/api/difficulties") {
    return jsonResponse(res, 200, {
      difficulties: Object.entries(difficulties).map(([id, info]) => ({ id, label: info.label }))
    });
  }

  if (req.method === "POST" && req.url === "/api/game/start") {
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

    return jsonResponse(res, 200, { gameId, scenario: publicScenario(scenario) });
  }

  if (req.method === "POST" && req.url === "/api/game/ask") {
    const body = await readJson(req);
    const session = sessions.get(body.gameId);
    const question = String(body.question || "").trim();

    if (!session) return jsonResponse(res, 404, { error: "游戏不存在或已过期" });
    if (!question) return jsonResponse(res, 400, { error: "请输入问题" });

    const localSolved = assessSolvedLocally(session, question);
    const result = localSolved ? { answer: "是", solved: true, nudge: "" } : await askLlm(session, question);

    session.messages.push({ role: "user", content: question });
    session.messages.push({ role: "assistant", content: [result.answer, result.nudge].filter(Boolean).join(" ") });
    session.updatedAt = Date.now();

    if (!result.solved && assessSolvedLocally(session, "")) {
      result.solved = true;
      result.answer = "是";
      result.nudge = "";
    }

    if (result.solved) {
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
    return jsonResponse(res, 200, revealPayload(session.scenario));
  }

  return jsonResponse(res, 404, { error: "API not found" });
}

async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const safePath = requested === "/" ? "/index.html" : requested;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8"
  };

  const content = await readFile(filePath);
  res.writeHead(200, {
    "content-type": contentTypes[ext] || "application/octet-stream"
  });
  res.end(content);
}

const cleanupTimer = setInterval(cleanupSessions, Math.min(SESSION_TTL_MS, 10 * 60 * 1000));
cleanupTimer.unref?.();

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    jsonResponse(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : PORT;
  console.log(`Ops Turtle Soup running at http://${HOST}:${actualPort}`);
});
