# Worklog: Simplify Host Answer Options

## Date

2026-07-01

## Work

- Removed `请换一种问法`, `是，但不完整`, and `否，但不完整` from host answer options.
- Unified easy, medium, and hard difficulties to only allow `是`, `否`, and `无关`.
- Updated local fallback behavior and LLM prompt constraints to map open-ended or unsupported questions to `无关`.
- Updated smoke/load test allowlists and development documentation.

## Modified Files

- `server.js`
- `tests/app-smoke.js`
- `tests/load-llm.js`
- `tests/llm-smoke.js`
- `docs/development.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: `npm run smoke:llm`

## Risks

- Open-ended player statements now receive `无关`, which is stricter but may feel less conversational.
- Live LLM behavior still depends on the configured internal model following JSON output constraints; server-side normalization protects the returned `answer`.

## Next

- Deploy the committed release to the intranet host if this behavior should be available to coworkers immediately.
