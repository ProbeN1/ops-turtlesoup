# Release Record Template

Copy this template for each intranet release and store the filled record under `docs/runbook/`.

Recommended filename:

```text
release-record-YYYY-MM-DD.md
```

Do not paste API keys or full `.env` secrets into the record.

## Release Summary

- Date:
- Operator:
- Release host:
- Host OS:
- Deployment mode: Docker Compose | systemd | Windows Scheduled Task | other
- Git commit:
- Expected player count:
- Shared URL:
- LLM endpoint host, without key:
- LLM model:

## Configuration Snapshot

Record non-secret values only.

```text
HOST=
PORT=
SESSION_TTL_MINUTES=
MAX_ACTIVE_SESSIONS=
REQUEST_LIMIT_BYTES=
HTTP_REQUEST_TIMEOUT_SECONDS=
SHUTDOWN_GRACE_SECONDS=
LLM_MAX_CONCURRENCY=
LLM_QUEUE_LIMIT=
LLM_REQUEST_TIMEOUT_SECONDS=
RATE_LIMIT_WINDOW_SECONDS=
RATE_LIMIT_MAX_REQUESTS=
```

## Process Evidence

Release archive:

```text
npm run build:release
```

Paste summary:

```text
archivePath=
sha256Path=
sha256=
releaseName=
.env excluded=yes | no
```

```text
npm run verify:release-archive
```

Result:

```text

```

Archive verification summary:

```text
archivePath=
sha256Path=
sha256=
expected files present=yes | no
forbidden paths absent=yes | no
manifest checked=yes | no
```

Docker Compose:

```text
docker compose ps
```

Paste summary:

```text

```

Systemd:

```text
systemctl status ops-turtle-soup
```

Paste summary:

```text

```

Windows Scheduled Task:

```text
Get-ScheduledTask -TaskName OpsTurtleSoup
```

Paste summary:

```text

```

## Verification Results

```text
npm test
```

Result:

```text

```

```text
npm run rehearse:release
```

Result:

```text

```

Rehearsal summary:

```text
baseUrl=
runLlm=
release archive build=pass | fail
release archive verification=pass | fail
offline deployment preflight=pass | fail
online deployment verification=pass | fail
application smoke=pass | fail
release evidence snapshot=pass | fail
100-session local capacity smoke=pass | fail
live LLM ask-path load smoke=pass | skipped | fail
```

```text
npm run verify:deploy:offline
```

Result:

```text

```

```text
npm run verify:deploy
```

Result:

```text

```

```text
npm run smoke:llm
```

Result:

```text

```

```text
npm run smoke:app
```

Result:

```text

```

```text
COWORKER_SMOKE_BASE_URL=http://<server-intranet-ip>:5725 npm run smoke:coworker
```

Result:

```text

```

```text
npm run evidence:release
```

Paste JSON summary:

```json

```

```text
npm run load:llm
```

Result:

```text

```

LLM load evidence summary:

```text
completed=
askLatency.avgMs=
askLatency.p95Ms=
askLatency.maxMs=
metricsDelta.gameQuestionsTotal=
metricsDelta.llmRequestsTotal=
metricsDelta.llmFailuresTotal=
metricsDelta.rateLimitedTotal=
prometheusMetrics.llmCountersPresent=
```

```text
npm run load:local
```

Result:

```text

```

Load evidence summary:

```text
completed=
metricsDelta.gameStartsTotal=
metricsDelta.gameRevealsTotal=
metricsDelta.rateLimitedTotal=
prometheusMetrics.gameCountersPresent=
```

## Browser UI Smoke

Run [UI Smoke Runbook](ui-smoke.md).

- Browser machine:
- Browser:
- Difficulty selection passed:
- Question flow passed:
- Chat collapse/expand passed:
- Reveal formatting passed:
- Solved celebration passed:

Notes:

```text

```

## Coworker Access Check

- Coworker machine or subnet:
- URL opened:
- Page loaded:
- Game started:
- One question answered:
- `npm run smoke:coworker` passed:

Notes:

```text

```

## Runtime Metrics Snapshot

Capture readiness after smoke checks:

```text
GET /api/ready
```

Paste non-sensitive summary:

```text
ready.ok=
ready.llm.apiKeyConfigured=
ready.llm.baseUrlConfigured=
ready.llm.modelConfigured=
ready.scenarioSets.easy=
ready.scenarioSets.medium=
ready.scenarioSets.hard=
ready.sessions.active=
ready.sessions.maxActive=
```

Capture runtime metrics after smoke checks:

```text
GET /api/metrics
GET /metrics
```

Paste non-sensitive summary:

```text
activeSessions=
gameStartsTotal=
gameQuestionsTotal=
gameRevealsTotal=
rateLimitedTotal=
llm.active=
llm.queued=
llm.requestsTotal=
llm.failuresTotal=
llm.avgLatencyMs=
prometheus.ops_turtle_soup_http_requests_total=present | missing
prometheus.ops_turtle_soup_llm_requests_total=present | missing
```

## Risks And Decisions

- Docker build verified on target host: yes | no
- Browser UI smoke automated: yes | no
- Sessions are in memory and will be lost on restart: acknowledged yes | no
- Single instance only, no horizontal scaling: acknowledged yes | no
- Rate limit tuned for shared proxy IPs: yes | no | not applicable
- LLM capacity confirmed for event: yes | no

Open risks:

```text

```

## Approval

- Operator:
- Reviewer:
- Release approved: yes | no
- Approval time:
