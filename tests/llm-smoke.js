import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";

const root = process.cwd();
const allowedAnswers = new Set(["是", "否", "无关"]);

loadEnvFile();

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
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

function llmEndpoint() {
  const url = new URL(llmBaseUrl());
  return {
    url,
    host: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    protocol: url.protocol
  };
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

function tcpProbe({ host, port }, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const startedAt = Date.now();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP connect to ${host}:${port} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(Date.now() - startedAt);
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`TCP connect to ${host}:${port} failed: ${error.code || error.message}`));
    });
  });
}

function describeFetchError(error, endpoint, timeoutMs) {
  if (error?.name === "AbortError") {
    return `LLM HTTP request to ${endpoint.host}:${endpoint.port} timed out after ${timeoutMs}ms`;
  }

  const cause = error?.cause;
  if (cause?.code) {
    return `LLM HTTP request to ${endpoint.host}:${endpoint.port} failed: ${cause.code}`;
  }

  return error?.message || "LLM HTTP request failed";
}

async function main() {
  const apiKey = requiredEnv("OPENAI_API_KEY", "LLM_API_KEY");
  const timeoutMs = Number(process.env.LLM_SMOKE_TIMEOUT_MS || Number(process.env.LLM_REQUEST_TIMEOUT_SECONDS || 30) * 1000);
  const tcpTimeoutMs = Math.min(timeoutMs, Number(process.env.LLM_SMOKE_TCP_TIMEOUT_MS || 5000));
  const endpoint = llmEndpoint();
  const tcpLatencyMs = await tcpProbe(endpoint, tcpTimeoutMs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint.url.href.replace(/\/$/, "")}/chat/completions`, {
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
              "JSON 格式必须是：{\"answer\":\"是\",\"solved\":false,\"nudge\":\"\"}",
              "nudge 必须为空字符串，不允许提供提示、方向、追问或解释。"
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
    if (parsed.nudge !== "") {
      throw new Error("LLM nudge field must be empty");
    }

    console.log("PASS LLM endpoint returned valid host JSON");
    console.log(`PASS TCP connect ${endpoint.host}:${endpoint.port} in ${tcpLatencyMs}ms`);
    console.log(`PASS model ${llmModel()} is reachable through ${endpoint.url.href.replace(/\/$/, "")}`);
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await main();
} catch (error) {
  try {
    const endpoint = llmEndpoint();
    const timeoutMs = Number(process.env.LLM_SMOKE_TIMEOUT_MS || Number(process.env.LLM_REQUEST_TIMEOUT_SECONDS || 30) * 1000);
    console.error(`FAIL ${describeFetchError(error, endpoint, timeoutMs)}`);
  } catch {
    console.error(`FAIL ${error.message}`);
  }
  process.exitCode = 1;
}
