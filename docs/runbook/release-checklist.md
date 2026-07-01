# Intranet Release Checklist

Use this checklist before sharing the game link with coworkers.

## Scope

Target release profile:

- one intranet host;
- one Node.js application instance;
- around 100 players;
- OpenAI-compatible internal LLM endpoint;
- in-memory game sessions;
- Docker Compose preferred for long-running hosting.

## Release Gate

Do not share the game URL until every required gate below is complete.

Create a release record from [Release Record Template](release-record-template.md) and paste command summaries there as evidence.

To create the record from the template and pre-fill non-sensitive fields, run:

```powershell
npm run init:release-record
```

| Gate | Command or Evidence | Required Result |
| --- | --- | --- |
| Code and scenario checks | `npm test` | Pass |
| Release record created | `npm run init:release-record` or existing filled record | Record exists for this release |
| Release record checked | `npm run check:release-record` | No missing evidence or sensitive values |
| Release archive | `npm run build:release` | Zip and `.sha256` created under `dist/` and excludes `.env` |
| Release archive verification | `npm run verify:release-archive` | Checksum, manifest, expected files, and forbidden-path checks pass |
| Local release rehearsal | `npm run rehearse:release` | Archive verification/evidence/offline/online/app/capacity smoke pass |
| Offline deployment preflight | `npm run verify:deploy:offline` | No `FAIL` |
| Long-running process configured | `docker compose ps`, `systemctl status ops-turtle-soup`, or `Get-ScheduledTask -TaskName OpsTurtleSoup` | Service is running with restart policy |
| Online deployment verification | `npm run verify:deploy` | No `FAIL` |
| Readiness endpoint | `GET /api/ready` | `ok=true`, LLM config present, all scenario sets loaded |
| Runtime metrics | `GET /api/metrics` and `GET /metrics` | JSON counters and Prometheus text counters are present |
| Release evidence snapshot | `npm run evidence:release` | Non-sensitive JSON summary captured, including build version and git commit |
| LLM compatibility | `npm run smoke:llm` | Pass |
| Game API flow | `EXPECTED_RELEASE_GIT_COMMIT=<git-short-sha> npm run smoke:app` | Pass and build commit matches release |
| Coworker access smoke | `COWORKER_SMOKE_BASE_URL=http://<server>:5725 EXPECTED_RELEASE_GIT_COMMIT=<git-short-sha> npm run smoke:coworker` | Pass from another intranet machine and build commit matches release |
| LLM ask-path load smoke | `npm run load:llm` | Completed configured live LLM asks with zero LLM failures |
| Browser UI flow | [UI Smoke Runbook](ui-smoke.md) | Manual browser flow passes |
| Local 100-session smoke | `npm run load:local` | Completed 100 sessions and reported game counter deltas >= 100 |
| Coworker access path | Browser from another intranet machine | Page loads and can start a game |

`WARN` from deployment verification must be reviewed. A `HOST` warning is acceptable only for local testing, not for coworker access.

`npm run check:release-record` is intentionally strict for a final intranet release. It fails unless the record proves `HOST=0.0.0.0`, target capacity is at least 100 active sessions, release archive verification passed, live LLM load ran with zero LLM failures, coworker access passed, browser UI smoke passed, required risks are acknowledged, and approval is `yes`.

## Configuration Gate

Confirm production `.env`:

```env
HOST=0.0.0.0
PORT=5725
MAX_ACTIVE_SESSIONS=300
OPENAI_API_KEY=...
OPENAI_BASE_URL=http://<internal-llm>/v1
OPENAI_MODEL=...
RELEASE_GIT_COMMIT=<git-short-sha>
RELEASE_NAME=<release-name>
LLM_MAX_CONCURRENCY=8
LLM_QUEUE_LIMIT=100
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120
```

Adjust `LLM_MAX_CONCURRENCY` only after confirming the internal LLM service capacity. If many users share one proxy IP, raise `RATE_LIMIT_MAX_REQUESTS` before the event.

## Process Gate

Preferred:

```bash
npm run build:release
export RELEASE_GIT_COMMIT="$(git rev-parse --short HEAD)"
export RELEASE_NAME="ops-turtle-soup-$(date +%Y%m%d%H%M)"
docker compose up -d --build
docker compose ps
```

Alternative on Linux without Docker:

```bash
sudo systemctl enable --now ops-turtle-soup
sudo systemctl status ops-turtle-soup
```

Do not host the release from an interactive terminal window.

## Verification Sequence

Run from the release host:

```powershell
npm test
npm run init:release-record
npm run build:release
npm run verify:release-archive
npm run rehearse:release
npm run check:release-record
npm run verify:deploy:offline
npm run verify:deploy
npm run evidence:release
npm run smoke:llm
EXPECTED_RELEASE_GIT_COMMIT=<git-short-sha> npm run smoke:app
COWORKER_SMOKE_BASE_URL=http://<server-intranet-ip>:5725 EXPECTED_RELEASE_GIT_COMMIT=<git-short-sha> npm run smoke:coworker
npm run load:llm
npm run load:local
```

For local load testing from one machine, start with:

```powershell
npm run start:loadtest
```

or temporarily set:

```env
RATE_LIMIT_MAX_REQUESTS=0
```

Restore production rate limiting after the load smoke test.

The load smoke output must show `completed` equal to `LOAD_TEST_USERS`, `metricsDelta.gameStartsTotal` and `metricsDelta.gameRevealsTotal` at least equal to `LOAD_TEST_USERS`, and `prometheusMetrics.gameCountersPresent=true`.

Paste `npm run evidence:release` output into the release record after app smoke and before sharing the coworker URL.
Confirm `build.gitCommit` in the evidence matches the intended release commit.
Also confirm the `build.gitCommit` printed by `npm run smoke:coworker` matches the intended release commit from the coworker network path.

For the LLM ask-path load smoke, start with the default `LLM_LOAD_USERS=10` and `LLM_LOAD_CONCURRENCY=2`. Before the event, run a release rehearsal with values agreed with the internal LLM owner, and confirm `metricsDelta.llmFailuresTotal=0`, `metricsDelta.llmRequestsTotal >= LLM_LOAD_USERS`, and acceptable `askLatency.p95Ms`.

To include live LLM load in the one-command rehearsal, run:

```powershell
REHEARSAL_RUN_LLM=1 npm run rehearse:release
```

The final release record must use a rehearsal where `runLlm=true` and `live LLM ask-path load smoke=pass`.

## Monitoring During Play

Watch:

- service health: `GET /api/health`;
- deployment readiness: `GET /api/ready`;
- runtime counters: `GET /api/metrics`;
- Prometheus scrape counters: `GET /metrics`;
- active sessions;
- LLM limiter active and queued counts;
- process logs: `docker compose logs -f ops-turtle-soup` or `journalctl -u ops-turtle-soup -f`;
- 429 responses from shared IP rate limiting;
- 503 responses from LLM queue backpressure;
- LLM queue full errors.

## Rollback

Docker Compose:

```bash
git log --oneline -5
git checkout <previous-known-good-commit>
docker compose up -d --build
npm run verify:deploy
npm run smoke:app
```

Systemd:

```bash
sudo systemctl stop ops-turtle-soup
git checkout <previous-known-good-commit>
sudo systemctl start ops-turtle-soup
npm run verify:deploy
npm run smoke:app
```

Active games are lost on restart because sessions are in memory.

## Known Release Risks

- Process restart clears active games.
- Multiple app instances require shared session storage, which is not implemented yet.
- LLM latency and rate limits are the primary capacity risk.
- Docker image build still needs verification on a host with Docker installed.
- Browser UI smoke is manual until Playwright browser binaries are available; verify one coworker browser before the event.
