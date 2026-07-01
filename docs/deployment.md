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
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=http://10.10.214.22:30002/v1
OPENAI_MODEL=b-glm-5.2
LLM_MAX_CONCURRENCY=8
LLM_QUEUE_LIMIT=100
LLM_SMOKE_TIMEOUT_MS=15000
APP_SMOKE_BASE_URL=http://127.0.0.1:5725
APP_SMOKE_DIFFICULTY=easy
APP_SMOKE_QUESTION=这个问题和业务流量暴涨有关吗？
APP_SMOKE_TIMEOUT_MS=30000
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120
```

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

## Docker

Docker Compose is the preferred long-running deployment path for a small intranet host.

Build:

```bash
docker build -t ops-turtle-soup .
```

Run:

```bash
docker run --env-file .env -p 5725:5725 ops-turtle-soup
```

Run with Compose:

```bash
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

## Release Checklist

Before sharing the intranet URL, complete [Intranet Release Checklist](runbook/release-checklist.md). It defines the required gates for configuration, process management, LLM compatibility, application smoke, and 100-session local smoke testing.

## Health Check

```text
GET /api/health
```

The endpoint returns process uptime, active session count, and configured difficulty names.

## Deployment Verification

After configuring `.env` and starting the service, run:

```powershell
npm run verify:deploy
```

The deployment verifier checks:

- Node.js version.
- Intranet binding and core runtime settings.
- LLM key, base URL, and model presence.
- Scenario schema and required operational fields.
- `/api/health` readiness and exposed limiter status.

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
- host JSON fields: `answer`, `solved`, and `nudge`;
- answer value belongs to the allowed host answer set.

It does not print the API key. Tune `LLM_SMOKE_TIMEOUT_MS` if the internal model is slow to wake up.

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

## Capacity Notes

For around 100 intranet users:

- Use a stable internal host, not a developer laptop.
- Configure `HOST=0.0.0.0`.
- Keep the LLM endpoint on the same intranet or low-latency network.
- Monitor `server.err.log` or process stderr.
- Use one Node process unless session persistence is externalized.
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

This test creates game sessions and reveals answers without calling the LLM-heavy ask path.
