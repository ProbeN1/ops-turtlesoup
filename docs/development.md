# Development

## Requirements

- Node.js 18 or newer.
- OpenAI-compatible LLM endpoint for full gameplay.

## Commands

```powershell
npm start
npm run dev
npm test
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

## Answer Rules

Allowed answers are difficulty-specific:

- easy: `是`, `否`, `无关`, `请换一种问法`, `是，但不完整`, `否，但不完整`
- medium: `是`, `否`, `无关`, `请换一种问法`
- hard: `是`, `否`, `无关`

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
