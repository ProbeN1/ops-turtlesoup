# Worklog: Capacity Smoke Metrics Evidence

Date: 2026-07-01

## Work Completed

- Strengthened `npm run load:local` so the 100-session smoke test captures initial and final runtime metrics.
- Added assertions that completed users match `LOAD_TEST_USERS`.
- Added assertions that `gameStartsTotal` and `gameRevealsTotal` increase by at least `LOAD_TEST_USERS`.
- Added Prometheus `/metrics` game-counter presence validation to the load smoke.
- Updated development, deployment, release checklist, release record template, and changelog documentation.

## Files Changed

- `tests/load-local.js`
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
npm run load:local
ok=true
totalUsers=100
concurrency=20
completed=100
elapsedMs=88
metricsDelta.gameStartsTotal=100
metricsDelta.gameRevealsTotal=100
metricsDelta.httpRequestsTotal=202
metricsDelta.rateLimitedTotal=0
prometheusMetrics.gameCountersPresent=true
```

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- The load smoke still avoids the LLM-heavy ask path, so it validates local session/scenario/reveal capacity rather than upstream LLM capacity.
- For a single source IP, rate limiting must be disabled or tuned during local load smoke.

## Next Steps

- Run the strengthened load smoke on the target release host and paste the metric deltas into a release record.
- Verify Docker image build and coworker browser access on the actual intranet host.
