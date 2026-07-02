# Worklog: LLM Smoke Test

Date: 2026-07-01

## Work Completed

- Added `npm run smoke:llm` for a live OpenAI-compatible LLM endpoint check.
- Validated that the model returns the JSON shape required by host gameplay: `answer`, `solved`, and `nudge`.
- Added `tests/llm-smoke.js` to syntax checks without making live LLM calls part of default tests.
- Documented the smoke test in README, deployment, startup, troubleshooting, and changelog docs.

## Files Changed

- `.env.example`
- `README.md`
- `package.json`
- `tests/llm-smoke.js`
- `docs/deployment.md`
- `docs/runbook/intranet-startup.md`
- `docs/troubleshooting.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
npm run smoke:llm
PASS LLM endpoint returned valid host JSON
PASS configured internal model is reachable through the internal LLM gateway
```

## Risks

- `npm run smoke:llm` makes one live LLM request and may consume internal LLM quota.
- If the internal LLM gateway does not support `response_format`, smoke test failure indicates the current gameplay path will likely fail too.

## Next Steps

- Add a full application-level smoke test that starts a game and asks one controlled question through `/api/game/ask`.
- Add long-running process manager guidance for production hosting.
