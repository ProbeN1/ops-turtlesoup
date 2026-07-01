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
data/scenarios/easy.json
data/scenarios/medium.json
data/scenarios/hard.json
```

For story/opening writing rules, difficulty style, and solve standards, see [Scenario Authoring](scenario-authoring.md).

## Answer Rules

Allowed answers are difficulty-specific:

- easy: `是`, `否`, `无关`, `请换一种问法`, `是，但不完整`, `否，但不完整`
- medium: `是`, `否`, `无关`, `请换一种问法`
- hard: `是`, `否`, `无关`

## Runtime Protection

The server includes simple in-process protection for intranet use:

- `PORT`: listening port, integer from 1 to 65535.
- `SESSION_TTL_MINUTES`: session retention window, positive integer.
- `REQUEST_LIMIT_BYTES`: maximum request body size, integer at least 4096.
- `LLM_MAX_CONCURRENCY`: maximum concurrent LLM requests.
- `LLM_QUEUE_LIMIT`: maximum queued LLM requests.
- `RATE_LIMIT_WINDOW_SECONDS`: request limit window.
- `RATE_LIMIT_MAX_REQUESTS`: max API requests per client IP per window.

Set `RATE_LIMIT_MAX_REQUESTS=0` to disable API rate limiting for a trusted test environment.

Invalid numeric runtime configuration fails fast during startup.

## Testing

Run:

```powershell
npm test
```

Tests validate:

- Scenario schema.
- Server syntax.
- Frontend script syntax.
- Core local solve behavior.

## Capacity Smoke Test

`npm run load:local` simulates 100 local game sessions by default. It validates the lightweight session and scenario-read path without spending LLM calls.

Use `npm run start:loadtest` before running the load smoke test from one machine; it disables API rate limiting for the local test process.
