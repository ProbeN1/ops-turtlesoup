# Ops Turtle Soup

一个运维海龟汤小游戏，帮助玩家从一句话拆出完整需求结构。玩家选择题库范围和难度后，通过只能用有限答案回答的问题逐步推理故障根因或拆解方案需求。

## Quick Start

```powershell
npm start
```

默认访问地址：

```text
http://127.0.0.1:5725/
```

## Configuration

复制 `.env.example` 为 `.env`，并配置内网 LLM：

```env
OPENAI_API_KEY=<your-api-key>
OPENAI_BASE_URL=http://<internal-llm-gateway>/v1
OPENAI_MODEL=<model-name>
HOST=127.0.0.1
PORT=5725
```

内网共享时将 `HOST` 改为 `0.0.0.0`，并放行对应端口。

## Health Check

```text
GET /api/health
GET /api/ready
```

## Docker

```bash
docker compose up -d
```

## Docs

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Development](docs/development.md)
- [Scenario Authoring](docs/scenario-authoring.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Changelog](docs/changelog.md)
- [Process Management](docs/runbook/process-management.md)
- [Release Checklist](docs/runbook/release-checklist.md)
- [UI Smoke](docs/runbook/ui-smoke.md)
- [Release Record Template](docs/runbook/release-record-template.md)
