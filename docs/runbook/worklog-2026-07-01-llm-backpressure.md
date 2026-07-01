# Worklog: LLM Backpressure Response

Date: 2026-07-01

## Work Completed

- Changed LLM queue saturation from a generic HTTP 500 to HTTP 503.
- Added a player-friendly response message: `主持繁忙，请稍后再试`.
- Preserved the internal detail `LLM queue is full` in the API response for release troubleshooting.
- Added regression coverage that saturates the LLM limiter and asserts the 503 response.
- Updated troubleshooting, release checklist, and changelog documentation.

## Files Changed

- `server.js`
- `tests/run-tests.js`
- `docs/troubleshooting.md`
- `docs/runbook/release-checklist.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

The test suite includes a regression case that saturates `LLM_MAX_CONCURRENCY=1` and `LLM_QUEUE_LIMIT=1`, then verifies queue overflow returns HTTP 503 with `主持繁忙，请稍后再试`.

```text
npm run rehearse:release
ok=true
offline deployment preflight=pass
online deployment verification=pass
application smoke=pass
100-session local capacity smoke=pass
```

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- 503 responses still mean players may need to retry; this change makes overload explicit rather than increasing LLM capacity.

## Next Steps

- Use `responsesByStatus.503`, `llm.queued`, and `llm.failuresTotal` during rehearsal to tune LLM concurrency and queue limits.
