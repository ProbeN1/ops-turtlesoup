# Worklog: LLM Fallback Host

## Date

2026-07-02

## Work

- Added local host fallback for `/api/game/ask` when the LLM is unavailable, returns HTTP errors such as 429, times out, returns non-JSON, or the in-process queue is full.
- The fallback uses each scenario's `question_rules` plus local solve checks and still only returns `是`, `否`, or `无关`.
- Added `llm.fallbacksTotal` to `/api/metrics`.
- Added `ops_turtle_soup_llm_fallbacks_total` to `/metrics`.
- Included fallback totals in release evidence snapshots.
- Updated troubleshooting, architecture, development, release checklist, and changelog documentation.

## Modified Files

- `server.js`
- `tests/run-tests.js`
- `tests/release-evidence.js`
- `docs/architecture.md`
- `docs/development.md`
- `docs/troubleshooting.md`
- `docs/runbook/release-checklist.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`.
- Added regression coverage for queue-full fallback returning an allowed host answer.
- Added regression coverage for LLM HTTP 429 fallback, `llm.failuresTotal`, `llm.fallbacksTotal`, and `ops_turtle_soup_llm_fallbacks_total`.

## Risks

- Local fallback is intentionally conservative and may answer `无关` when the LLM would infer a more nuanced yes/no from context.
- Final event readiness still requires live LLM smoke and load tests with zero LLM failures; fallback is degraded mode, not a replacement for LLM capacity.

## Next

- Build and deploy a release containing the fallback.
