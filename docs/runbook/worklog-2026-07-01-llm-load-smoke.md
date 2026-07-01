# Worklog: LLM Load Smoke

Date: 2026-07-01

## Work Completed

- Added `npm run load:llm` for configurable live ask-path load smoke testing.
- The script exercises `/api/game/start` and `/api/game/ask`, so it validates runtime LLM calls through the application path.
- Added checks for allowed difficulty-specific answers, completed users, LLM request counter deltas, zero LLM failure deltas, game question counter deltas, and Prometheus LLM counter presence.
- Added ask latency summary output with average, p95, and max latency.
- Added optional `LLM_LOAD_MAX_P95_MS` gate for release rehearsals.
- Updated development, deployment, release checklist, release record template, and changelog documentation.

## Files Changed

- `package.json`
- `tests/load-llm.js`
- `tests/run-tests.js`
- `docs/development.md`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
LLM_LOAD_USERS=10 LLM_LOAD_CONCURRENCY=2 npm run load:llm
ok=true
completed=10
elapsedMs=32022
askLatency.avgMs=5994
askLatency.p95Ms=8311
askLatency.maxMs=8311
metricsDelta.gameQuestionsTotal=10
metricsDelta.llmRequestsTotal=20
metricsDelta.llmFailuresTotal=0
metricsDelta.rateLimitedTotal=0
prometheusMetrics.llmCountersPresent=true
```

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- `npm run load:llm` makes real LLM calls and may consume internal model quota.
- The default is intentionally small; a 100-user rehearsal must be coordinated with the internal LLM owner.

## Next Steps

- Run `npm run load:llm` on the target host after deployment.
- For event rehearsal, set `LLM_LOAD_USERS`, `LLM_LOAD_CONCURRENCY`, and optionally `LLM_LOAD_MAX_P95_MS` according to the agreed LLM capacity target.
