# Worklog: Application Smoke Test

Date: 2026-07-01

## Work Completed

- Added `npm run smoke:app` for full game API smoke verification.
- Validated health, start, ask, and reveal endpoints through the public HTTP API.
- Added application smoke test syntax checking to `npm run check`.
- Documented application smoke test usage in README, deployment, startup, troubleshooting, and changelog docs.

## Files Changed

- `.env.example`
- `README.md`
- `package.json`
- `tests/app-smoke.js`
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
npm run smoke:app
PASS application health endpoint is reachable
PASS started easy game 22cc0b42-eb26-47ba-93e7-50b33f5e77f9
PASS ask path returned allowed answer: 无关
PASS reveal path returned complete answer payload
```

## Risks

- `npm run smoke:app` calls `/api/game/ask`, so with LLM configured it makes one live LLM request.
- The smoke test validates API contract and one gameplay turn; it is not a browser rendering test.

## Next Steps

- Add long-running process manager guidance for Windows service, systemd, or PM2.
- Consider adding browser-level smoke verification if the UI becomes more complex.
