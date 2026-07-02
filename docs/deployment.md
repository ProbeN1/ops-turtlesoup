# Deployment

## Local Development

```powershell
npm start
```

Default URL:

```text
http://127.0.0.1:5725/
```

## Intranet Deployment

Set `.env`:

```env
HOST=0.0.0.0
PORT=5725
MAX_ACTIVE_SESSIONS=300
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
RELEASE_GIT_COMMIT=<git-short-sha>
RELEASE_NAME=<release-name>
LLM_MAX_CONCURRENCY=8
LLM_QUEUE_LIMIT=100
LLM_REQUEST_TIMEOUT_SECONDS=30
HTTP_REQUEST_TIMEOUT_SECONDS=60
SHUTDOWN_GRACE_SECONDS=10
LLM_SMOKE_TIMEOUT_MS=15000
APP_SMOKE_BASE_URL=http://127.0.0.1:5725
APP_SMOKE_DIFFICULTY=easy
APP_SMOKE_QUESTION=这个问题和业务流量暴涨有关吗？
APP_SMOKE_TIMEOUT_MS=30000
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120
```

Numeric runtime settings are validated at startup. Invalid values, such as an out-of-range `PORT` or `LLM_QUEUE_LIMIT` lower than `LLM_MAX_CONCURRENCY`, cause the service to exit before listening.

Keep internal LLM endpoint URLs, model names, and API keys only in the target host `.env`. Do not paste those values into README, runbooks, release records, or commits.

The feedback page is a static intranet contact page. Players send feedback through DingTalk to `0027029145` 姜毅 or email `jiang.yi12@iwhalecloud.com`, using the copyable template on `/feedback`.

If startup fails while binding the port, stderr prints a `Startup failed:` message. Common causes are an existing process already using `HOST:PORT` or an account without permission to bind the configured port.

The server sets HTTP request, header, and keep-alive timeouts from runtime configuration. On `SIGTERM` or `SIGINT`, it stops accepting new connections and exits after the graceful shutdown window.

For a quick local check, start service:

```powershell
npm start
```

For a long-running intranet service, prefer Docker Compose or systemd instead of leaving an interactive terminal open.

Users access:

```text
http://<server-intranet-ip>:5725/
```

## Windows Firewall

Allow inbound TCP on the configured `PORT`.

## Release Archive

For hosts where Docker is not available, build a portable release archive:

```powershell
npm run build:release
npm run verify:release-archive
```

The build command writes `dist/ops-turtle-soup-<version>-<timestamp>.zip`, a sidecar `.sha256` checksum file, `RELEASE_MANIFEST.txt`, and `RELEASE_INFO.json`. The verification command checks the latest archive, or `RELEASE_ARCHIVE_PATH` when set, by validating the SHA256 sidecar, extracting the zip, requiring expected release files, and rejecting forbidden paths such as `.env`, `.git`, `node_modules`, logs, and previous `dist` output. Copy the archive to the intranet host, verify the checksum, extract it, create `.env` from `.env.example`, then start the service with Docker Compose, systemd, Windows Scheduled Task, or the approved local process manager.

To start a release record from the template:

```powershell
npm run init:release-record
```

The command creates `docs/runbook/release-record-YYYY-MM-DD.md` and pre-fills non-sensitive fields such as date, git commit, host OS, expected player count, selected runtime settings, and LLM model. It refuses to overwrite an existing record.

After filling the release evidence, validate the record:

```powershell
npm run check:release-record
```

Use `RELEASE_RECORD_PATH` to check a specific record file. The checker is a final-release gate, not a loose lint: it requires intranet binding, at least 100 active sessions, verified release archive contents, passing live LLM load evidence, coworker access evidence, browser UI smoke evidence, risk acknowledgement, and release approval.

## Docker

Docker Compose is the preferred long-running deployment path for a small intranet host.

Build:

```bash
docker build --build-arg RELEASE_GIT_COMMIT="$(git rev-parse --short HEAD)" --build-arg RELEASE_NAME="ops-turtle-soup-$(date +%Y%m%d%H%M)" -t ops-turtle-soup .
```

Run:

```bash
docker run --env-file .env -p 5725:5725 ops-turtle-soup
```

Run with Compose:

```bash
export RELEASE_GIT_COMMIT="$(git rev-parse --short HEAD)"
export RELEASE_NAME="ops-turtle-soup-$(date +%Y%m%d%H%M)"
docker compose up -d
```

Check container health:

```bash
docker compose ps
docker compose logs -f ops-turtle-soup
```

The image probes `/api/health` through a Docker `HEALTHCHECK`, and `docker-compose.yml` uses `restart: unless-stopped`.

## Systemd

For a Linux host without Docker, use the sample unit:

```text
deploy/systemd/ops-turtle-soup.service.example
```

Typical installation outline:

```bash
sudo useradd --system --home /opt/ops-turtle-soup --shell /usr/sbin/nologin ops-turtle-soup
sudo mkdir -p /opt/ops-turtle-soup
sudo cp -r . /opt/ops-turtle-soup
sudo chown -R ops-turtle-soup:ops-turtle-soup /opt/ops-turtle-soup
sudo cp deploy/systemd/ops-turtle-soup.service.example /etc/systemd/system/ops-turtle-soup.service
sudo systemctl daemon-reload
sudo systemctl enable --now ops-turtle-soup
sudo systemctl status ops-turtle-soup
```

Run deployment verification after the service is active.

## Windows Scheduled Task

For a Windows intranet host without Docker, install a startup scheduled task from an elevated PowerShell session:

```powershell
.\deploy\windows\install-scheduled-task.ps1 -RunNow
```

The task starts `npm start` from the project directory on boot and writes logs under `logs/`. Keep `.env` in the project directory before registering the task.

Useful commands:

```powershell
Get-ScheduledTask -TaskName OpsTurtleSoup
Start-ScheduledTask -TaskName OpsTurtleSoup
Stop-ScheduledTask -TaskName OpsTurtleSoup
Unregister-ScheduledTask -TaskName OpsTurtleSoup
```

Run deployment verification and smoke tests after the task starts.

## Release Checklist

Before sharing the intranet URL, complete [Intranet Release Checklist](runbook/release-checklist.md). It defines the required gates for configuration, process management, LLM compatibility, application smoke, and 100-session local smoke testing.

For a one-command local rehearsal on the release host, run:

```powershell
npm run rehearse:release
```

This builds and verifies the release archive, starts a temporary local service, runs offline and online deployment verification, runs the app smoke, captures release evidence, and runs the 100-session local capacity smoke. Set `REHEARSAL_RUN_LLM=1` to include the live LLM ask-path load smoke in that rehearsal.

## Health Check

```text
GET /api/health
```

The endpoint returns build identity, process uptime, active session count, and configured difficulty names.

## Readiness Check

```text
GET /api/ready
```

The readiness endpoint returns non-sensitive build identity and deployment readiness checks for:

- LLM API key, base URL, and model presence;
- scenario loading for every difficulty;
- LLM limiter settings;
- rate-limit settings.

It does not return API keys or the configured LLM base URL. A `503` response means the service is running but should not be treated as ready for release.

## Runtime Metrics

```text
GET /api/metrics
```

The metrics endpoint returns in-memory counters for:

- build identity;
- HTTP/API/static request volume;
- response status counts;
- rate-limited requests;
- application errors;
- game starts, questions, reveals, and solved games;
- active sessions and cached scenario sets;
- LLM active/queued calls, failures, and average latency.
- game flow, runtime health, LLM, and rate-limit counters.

For Prometheus-compatible monitoring, scrape:

```text
GET /metrics
```

The text endpoint uses metric names prefixed with `ops_turtle_soup_`, including request counters, game counters, rate-limit counters, active sessions, and LLM queue/latency gauges.

## Release Evidence

After the service is running, capture a non-sensitive release evidence snapshot:

```powershell
npm run evidence:process
npm run evidence:release
```

`npm run evidence:process` captures non-sensitive target-host process evidence, including build identity, listening port status, and available Docker Compose, systemd, or Windows Scheduled Task status. Use `PROCESS_EVIDENCE_BASE_URL` when probing through a reverse proxy or a different hostname.

`npm run evidence:release` reads `GET /api/health`, `GET /api/ready`, `GET /api/metrics`, and `GET /metrics`, then prints JSON suitable for the release record. Use `RELEASE_EVIDENCE_BASE_URL` when testing through a reverse proxy or coworker-facing intranet hostname.
The JSON includes non-sensitive build identity so the release record can prove which version and commit is running on the target host.

## Deployment Verification

After configuring `.env` and starting the service, run:

```powershell
npm run verify:deploy
```

The deployment verifier checks:

- Node.js version.
- Intranet binding and core runtime settings.
- LLM key, base URL, and model presence.
- LLM request timeout and limiter settings.
- Scenario schema and required operational fields.
- `/api/health` readiness and exposed limiter status.
- `/api/ready` deployment readiness without exposing secrets.
- JSON and Prometheus runtime metrics endpoints.

For offline preflight before starting the service, run:

```powershell
npm run verify:deploy:offline
```

The offline mode skips only the health endpoint probe.

## LLM Smoke Test

Before sharing the game, verify the internal LLM endpoint can return the JSON shape required by the host logic:

```powershell
npm run smoke:llm
```

This command calls the configured OpenAI-compatible `/chat/completions` endpoint once and checks:

- endpoint reachability;
- HTTP JSON response;
- `choices[0].message.content` presence;
- host JSON fields: `answer`, `solved`, and `nudge`; `nudge` is retained for protocol compatibility but must be an empty string;
- answer value belongs to the allowed host answer set.

It does not print the API key. Tune `LLM_SMOKE_TIMEOUT_MS` if the internal model is slow to wake up.
Use `LLM_SMOKE_TCP_TIMEOUT_MS` to tune only the TCP preflight timeout. A TCP timeout means the app host cannot reach the LLM gateway port; an HTTP timeout means the port is reachable but the gateway or model did not complete the chat request in time.

## Application Smoke Test

After the service starts and the LLM smoke test passes, verify the full game API path:

```powershell
npm run smoke:app
```

This command calls:

- `GET /api/health`
- `POST /api/game/start`
- `POST /api/game/ask`
- `POST /api/game/reveal`

It validates that a game can be started, one question can be answered with a difficulty-allowed host answer, and the reveal payload is complete. Use `APP_SMOKE_BASE_URL` when testing through a reverse proxy or a different intranet hostname.
Set `EXPECTED_RELEASE_GIT_COMMIT` or `APP_SMOKE_EXPECTED_GIT_COMMIT` to fail the smoke when the running service is not the intended release commit.

## Coworker Access Smoke Test

From a coworker machine or another intranet segment, verify that the shared URL is reachable:

```powershell
$env:COWORKER_SMOKE_BASE_URL="http://<server-intranet-ip>:5725"
$env:EXPECTED_RELEASE_GIT_COMMIT="<git-short-sha>"
npm run smoke:coworker
```

This checks health, readiness, homepage loading, `app.js` loading with `no-store`, game start, and reveal payload. It does not call the LLM ask path, so pair it with `npm run smoke:llm` or `npm run load:llm` on the release host.
It also prints the build identity returned by the coworker-facing URL, and fails when `EXPECTED_RELEASE_GIT_COMMIT` or `COWORKER_SMOKE_EXPECTED_GIT_COMMIT` is set but does not match.

## LLM Load Smoke Test

After the app smoke test passes, run a small live LLM ask-path load smoke:

```powershell
npm run load:llm
```

Defaults:

- `LLM_LOAD_USERS=10`
- `LLM_LOAD_CONCURRENCY=2`
- `LLM_LOAD_BASE_URL` falls back to `APP_SMOKE_BASE_URL` or `HOST`/`PORT`
- `LLM_LOAD_TIMEOUT_MS=60000`

For a release rehearsal, tune `LLM_LOAD_USERS`, `LLM_LOAD_CONCURRENCY`, and optionally `LLM_LOAD_MAX_P95_MS` to match the internal LLM capacity target. This command makes real LLM calls and fails if LLM request counters do not increase, LLM failures increase, answer values are outside the selected difficulty, or Prometheus LLM counters are missing.

## Capacity Notes

For around 100 intranet users:

- Use a stable internal host, not a developer laptop.
- Configure `HOST=0.0.0.0`.
- Keep the LLM endpoint on the same intranet or low-latency network.
- Monitor `server.err.log` or process stderr.
- Use one Node process unless session persistence is externalized.
- Keep `MAX_ACTIVE_SESSIONS` at least 100 for the target release profile; the default `300` leaves rehearsal and retry headroom.
- Tune `LLM_MAX_CONCURRENCY` to match the internal LLM service capacity.
- Tune `RATE_LIMIT_MAX_REQUESTS` if many players share one proxy IP.

## Local Capacity Smoke Test

After starting the service, run:

```powershell
npm run load:local
```

For local smoke tests from a single machine, start the service with request limiting disabled:

```powershell
npm run start:loadtest
```

Defaults:

- `LOAD_TEST_USERS=100`
- `LOAD_TEST_CONCURRENCY=20`
- `LOAD_TEST_BASE_URL=http://127.0.0.1:5725`

This test creates game sessions and reveals answers without calling the LLM-heavy ask path. It fails if completion count is short, if `gameStartsTotal` or `gameRevealsTotal` do not increase by at least `LOAD_TEST_USERS`, or if Prometheus game counters are missing from `/metrics`.
