# Worklog: Live LLM Release Rehearsal

Date: 2026-07-01

## Work

- Ran the full release rehearsal with live LLM ask-path load enabled.
- Verified release archive build and archive verification inside the rehearsal.
- Verified offline and online deployment checks, application smoke, release evidence capture, 100-session local capacity smoke, and live LLM load smoke.

## Command

```powershell
REHEARSAL_RUN_LLM=1 npm run rehearse:release
```

## Result

- Rehearsal status: passed.
- Release archive verification: passed.
- Application smoke: passed.
- 100-session local capacity smoke: passed.
- Live LLM load smoke: passed.

## Live LLM Load Evidence

```text
LLM_LOAD_USERS=10
LLM_LOAD_CONCURRENCY=2
completed=10
askLatency.avgMs=4607
askLatency.p95Ms=5518
askLatency.maxMs=5518
metricsDelta.gameQuestionsTotal=10
metricsDelta.llmRequestsTotal=20
metricsDelta.llmFailuresTotal=0
metricsDelta.rateLimitedTotal=0
prometheusMetrics.llmCountersPresent=true
```

## 100-Session Local Capacity Evidence

```text
LOAD_TEST_USERS=100
LOAD_TEST_CONCURRENCY=20
completed=100
metricsDelta.gameStartsTotal=100
metricsDelta.gameRevealsTotal=100
metricsDelta.rateLimitedTotal=0
prometheusMetrics.gameCountersPresent=true
```

## Risk

- This evidence was captured against a temporary local service on the current machine, not from a coworker machine or the final intranet host.
- The release still requires target-host process evidence and coworker access evidence before broad sharing.

## Next

- Run the same release gates on the target intranet host.
- Capture coworker access smoke from another machine or subnet.
