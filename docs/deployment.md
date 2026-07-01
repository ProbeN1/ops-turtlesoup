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
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=120
```

Start service:

```powershell
npm start
```

Users access:

```text
http://<server-intranet-ip>:5725/
```

## Windows Firewall

Allow inbound TCP on the configured `PORT`.

## Docker

Build:

```bash
docker build -t ops-turtle-soup .
```

Run:

```bash
docker run --env-file .env -p 5725:5725 ops-turtle-soup
```

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
