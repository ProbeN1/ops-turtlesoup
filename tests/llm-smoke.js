import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedAnswers = new Set(["是", "否", "无关", "请换一种问法", "是，但不完整", "否，但不完整"]);

loadEnvFile();

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

function requiredEnv(primary, fallback) {
  const value = process.env[primary] || process.env[fallback];
  if (!value) {
    throw new Error(`${primary} or ${fallback} is required`);
  }
  return value;
}

function llmBaseUrl() {
  return requiredEnv("OPENAI_BASE_URL", "LLM_BASE_URL").replace(/\/$/, "");
}

function llmModel() {
  return requiredEnv("OPENAI_MODEL", "LLM_MODEL");
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("model response did not contain JSON");
  }
}

async function main() {
  const apiKey = requiredEnv("OPENAI_API_KEY", "LLM_API_KEY");
  const timeoutMs = Number(process.env.LLM_SMOKE_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
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
              "你是运维故障海龟汤主持人连通性测试。",
              "只输出 JSON，不要输出 Markdown。",
              "JSON 格式必须是：{\"answer\":\"是\",\"solved\":false,\"nudge\":\"\"}"
            ].join("\n")
          },
          {
            role: "user",
            content: "请按指定 JSON 格式回答：这是一次连通性测试吗？"
          }
        ]
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`LLM returned HTTP ${response.status}: ${responseText.slice(0, 240)}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`LLM returned non-JSON content-type: ${contentType || "unknown"}`);
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("LLM response missing choices[0].message.content");
    }

    const parsed = parseModelJson(content);
    if (!allowedAnswers.has(parsed.answer)) {
      throw new Error(`LLM answer is not an allowed host answer: ${JSON.stringify(parsed.answer)}`);
    }

    if (typeof parsed.solved !== "boolean") {
      throw new Error("LLM solved field must be boolean");
    }

    if (typeof parsed.nudge !== "string") {
      throw new Error("LLM nudge field must be string");
    }

    console.log("PASS LLM endpoint returned valid host JSON");
    console.log(`PASS model ${llmModel()} is reachable through ${llmBaseUrl()}`);
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
