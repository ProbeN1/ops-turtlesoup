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

| Gate | Command or Evidence | Required Result |
| --- | --- | --- |
| Code and scenario checks | `npm test` | Pass |
| Local release rehearsal | `npm run rehearse:release` | Offline/online/app/capacity smoke pass |
| Offline deployment preflight | `npm run verify:deploy:offline` | No `FAIL` |
| Long-running process configured | `docker compose ps` or `systemctl status ops-turtle-soup` | Service is running with restart policy |
| Online deployment verification | `npm run verify:deploy` | No `FAIL` |
| Runtime metrics | `GET /api/metrics` and `GET /metrics` | JSON counters and Prometheus text counters are present |
| LLM compatibility | `npm run smoke:llm` | Pass |
| Game API flow | `npm run smoke:app` | Pass |
| LLM ask-path load smoke | `npm run load:llm` | Completed configured live LLM asks with zero LLM failures |
| Browser UI flow | [UI Smoke Runbook](ui-smoke.md) | Manual browser flow passes |
| Local 100-session smoke | `npm run load:local` | Completed 100 sessions and reported game counter deltas >= 100 |
| Coworker access path | Browser from another intranet machine | Page loads and can start a game |

`WARN` from deployment verification must be reviewed. A `HOST` warning is acceptable only for local testing, not for coworker access.

## Configuration Gate

Confirm production `.env`:

```env
HOST=0.0.0.0
PORT=5725
OPENAI_API_KEY=...
OPENAI_BASE_URL=http://<internal-llm>/v1
OPENAI_MODEL=...
LLM_MAX_CONCURRENCY=8
LLM_QUEUE_LIMIT=100
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120
```

Adjust `LLM_MAX_CONCURRENCY` only after confirming the internal LLM service capacity. If many users share one proxy IP, raise `RATE_LIMIT_MAX_REQUESTS` before the event.

## Process Gate

Preferred:

```bash
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
npm run rehearse:release
npm run verify:deploy:offline
npm run verify:deploy
npm run smoke:llm
npm run smoke:app
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

For the LLM ask-path load smoke, start with the default `LLM_LOAD_USERS=10` and `LLM_LOAD_CONCURRENCY=2`. Before the event, run a release rehearsal with values agreed with the internal LLM owner, and confirm `metricsDelta.llmFailuresTotal=0`, `metricsDelta.llmRequestsTotal >= LLM_LOAD_USERS`, and acceptable `askLatency.p95Ms`.

To include live LLM load in the one-command rehearsal, run:

```powershell
REHEARSAL_RUN_LLM=1 npm run rehearse:release
```

## Monitoring During Play

Watch:

- service health: `GET /api/health`;
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
