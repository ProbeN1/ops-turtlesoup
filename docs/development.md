# Development

## Requirements

- Node.js 18 or newer.
- OpenAI-compatible LLM endpoint for full gameplay.

## Commands

```powershell
npm start
npm run start:loadtest
npm run dev
npm test
npm run load:local
npm run load:llm
npm run rehearse:release
```

## Scenario Schema

Each scenario must follow this JSON shape:

```json
{
  "id": "easy-001",
  "title": "",
  "difficulty": "easy | medium | hard",
  "category": "",
  "tags": [],
  "infra_background": {},
  "story": "",
  "answer": "",
  "must_discover": [],
  "misleading": [],
  "forbidden": [],
  "question_rules": {
    "yes": [],
    "no": [],
    "irrelevant": []
  },
  "thinking_path": [],
  "root_cause": "",
  "temporary_fix": "",
  "permanent_fix": "",
  "knowledge_points": [],
  "references": []
}
```

## Data Files

Scenarios live in:

```text
data/scenarios/easy/简单-001-健康的服务没有后端.json
data/scenarios/medium/中等-001-只影响老用户的发布.json
data/scenarios/hard/困难-001-恢复后更严重的地域故障.json
```

Each file contains exactly one scenario object. The filename uses `难度-编号-题目.json`; the JSON `id` remains stable, for example `简单-002-只在午夜响起的磁盘告警.json` contains `"id": "easy-002"`.

For story/opening writing rules, difficulty style, and solve standards, see [Scenario Authoring](scenario-authoring.md). For turning raw incident notes into a new one-file scenario, see [Scenario Intake](scenario-intake.md).

## Answer Rules

Allowed answers are difficulty-specific:

- easy: `是`, `否`, `无关`
- medium: `是`, `否`, `无关`
- hard: `是`, `否`, `无关`

## Runtime Protection

The server includes simple in-process protection for intranet use:

- `PORT`: listening port, integer from 1 to 65535.
- `SESSION_TTL_MINUTES`: session retention window, positive integer.
- `MAX_ACTIVE_SESSIONS`: maximum active game sessions, positive integer.
- `REQUEST_LIMIT_BYTES`: maximum request body size, integer at least 4096.
- `HTTP_REQUEST_TIMEOUT_SECONDS`: HTTP request timeout, integer at least 5.
- `SHUTDOWN_GRACE_SECONDS`: graceful shutdown timeout, positive integer.
- `LLM_MAX_CONCURRENCY`: maximum concurrent LLM requests.
- `LLM_QUEUE_LIMIT`: maximum queued LLM requests.
- `LLM_REQUEST_TIMEOUT_SECONDS`: maximum duration for one runtime LLM request.
- `RATE_LIMIT_WINDOW_SECONDS`: request limit window.
- `RATE_LIMIT_MAX_REQUESTS`: max API requests per client IP per window.

Set `RATE_LIMIT_MAX_REQUESTS=0` to disable API rate limiting for a trusted test environment.

Feedback is handled through the static `/feedback` page. Players contact `0027029145` 姜毅 on DingTalk or email `jiang.yi12@iwhalecloud.com` and can copy the provided feedback template.

The game page shows an RCA progress bar under the opening story. The backend estimates closeness from cumulative player wording and the scenario's required discovery points, but responses must not expose which hidden points were matched.

Invalid numeric runtime configuration fails fast during startup.

## Testing

Run:

```powershell
npm test
```

Tests validate:

- Scenario schema.
- One-scenario-per-file layout.
- Server syntax.
- Frontend script syntax.
- Core local solve behavior.

## Capacity Smoke Test

`npm run load:local` simulates 100 local game sessions by default. It validates the lightweight session and scenario-read path without spending LLM calls. The script also checks `/api/metrics` and `/metrics` after the run, then prints a JSON summary with completed users, elapsed time, game counter deltas, rate-limit deltas, and Prometheus game-counter presence.

Use `npm run start:loadtest` before running the load smoke test from one machine; it disables API rate limiting for the local test process.

## LLM Load Smoke Test

`npm run load:llm` runs a configurable live ask-path smoke test through `/api/game/start` and `/api/game/ask`. It makes real runtime LLM calls, so keep the default small during development and scale it only for release verification.

Defaults:

- `LLM_LOAD_USERS=10`
- `LLM_LOAD_CONCURRENCY=2`
- `LLM_LOAD_DIFFICULTY=easy`
- `LLM_LOAD_TIMEOUT_MS=60000`

Optional gate:

- `LLM_LOAD_MAX_P95_MS`: fail if measured ask-path p95 exceeds this value.

## Release Rehearsal

`npm run rehearse:release` starts a temporary local service with load-test rate limiting, then runs offline deployment preflight, online deployment verification, application smoke, and the 100-session local capacity smoke. It chooses a temporary port by default and prints a JSON summary.

Set `REHEARSAL_RUN_LLM=1` to include `npm run load:llm` in the rehearsal.
