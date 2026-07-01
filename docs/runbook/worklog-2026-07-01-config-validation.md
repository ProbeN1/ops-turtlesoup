# Worklog: Runtime Configuration Validation

Date: 2026-07-01

## Work Completed

- Added fail-fast numeric runtime configuration validation during server startup.
- Aligned deployment verification checks with server startup constraints.
- Added a regression test that invalid `PORT` exits before the server starts.
- Documented validated settings and immediate-exit troubleshooting.

## Files Changed

- `server.js`
- `tests/verify-deploy.js`
- `tests/run-tests.js`
- `docs/development.md`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
npm run verify:deploy:offline
PASS SESSION_TTL_MINUTES is valid
PASS LLM_MAX_CONCURRENCY is valid
PASS LLM_QUEUE_LIMIT can absorb current concurrency
PASS RATE_LIMIT_WINDOW_SECONDS is valid
PASS RATE_LIMIT_MAX_REQUESTS is valid
PASS REQUEST_LIMIT_BYTES is large enough for game requests
```

Temporary server on port 5736 returned:

```text
GET /api/health
ok: true
```

## Risks

- Existing deployments with invalid-but-previously-tolerated numeric settings will now fail at startup.
- `.env` values must use plain numeric strings for numeric settings.

## Next Steps

- Add validation for URL-like LLM base URL if configuration mistakes continue.
- Keep deployment verifier and server startup validation in sync when adding new runtime settings.
