# Worklog: Session Capacity Limit

Date: 2026-07-01

## Work Completed

- Added `MAX_ACTIVE_SESSIONS` with default `300`.
- Added active session capacity to health, readiness, JSON metrics, and Prometheus metrics.
- Return HTTP 503 with `房间已满，请稍后再试` when new game sessions would exceed the configured cap.
- Deployment verification now requires `MAX_ACTIVE_SESSIONS >= 100` for the target release profile.
- Added regression coverage for session capacity overflow.
- Updated development, deployment, troubleshooting, release record template, and changelog documentation.

## Files Changed

- `.env.example`
- `server.js`
- `tests/app-smoke.js`
- `tests/run-tests.js`
- `tests/verify-deploy.js`
- `docs/development.md`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

The test suite includes a regression case that starts the service with `MAX_ACTIVE_SESSIONS=1`, starts one game, then verifies the second start returns HTTP 503 with `房间已满，请稍后再试`.

```text
npm run rehearse:release
PASS MAX_ACTIVE_SESSIONS can support the target player count
PASS readiness endpoint exposes session capacity
PASS application smoke
PASS 100-session local capacity smoke
```

```text
npm run verify:deploy:offline
PASS MAX_ACTIVE_SESSIONS can support the target player count
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- The cap protects process memory and operator visibility; it does not preserve sessions across restarts.
- If `SESSION_TTL_MINUTES` is too high, abandoned games can occupy capacity longer than desired.

## Next Steps

- Tune `MAX_ACTIVE_SESSIONS` and `SESSION_TTL_MINUTES` on the target host after release rehearsal.
