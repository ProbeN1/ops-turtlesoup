# Troubleshooting

## Service Cannot Be Reached

Check whether the configured port is listening:

```powershell
netstat -ano | Select-String ':5725'
```

Check logs:

```powershell
Get-Content .\server.out.log
Get-Content .\server.err.log
```

## Service Exits Immediately

Check stderr or the process manager journal for configuration validation errors.

Examples:

- `PORT must be <= 65535`
- `LLM_QUEUE_LIMIT must be >= 8`
- `REQUEST_LIMIT_BYTES must be >= 4096`

Fix `.env`, then restart the service and run:

```powershell
npm run verify:deploy:offline
```

Check runtime counters:

```powershell
Invoke-RestMethod http://127.0.0.1:5725/api/metrics
```

## Deployment Verification Fails

Run:

```powershell
npm run verify:deploy
```

Interpretation:

- `FAIL` means the deployment should not be considered ready.
- `WARN` means the service may run, but the setting should be reviewed before sharing with coworkers.
- The verifier never prints API keys; it only checks whether required LLM settings are present.

If the health check fails, confirm the service is already running and that `DEPLOY_VERIFY_BASE_URL` points to the correct address:

```powershell
$env:DEPLOY_VERIFY_BASE_URL="http://127.0.0.1:5725"
npm run verify:deploy
```

## LLM Returns HTML Or Invalid JSON

Verify `OPENAI_BASE_URL` ends with the OpenAI-compatible API prefix, usually `/v1`.

Example:

```env
OPENAI_BASE_URL=http://10.10.214.22:30002/v1
```

## LLM Smoke Test Fails

Run:

```powershell
npm run smoke:llm
```

Common causes:

- `OPENAI_BASE_URL` does not point to an OpenAI-compatible `/v1` endpoint.
- The configured model name is not available on the internal LLM gateway.
- The gateway rejects `response_format: {"type":"json_object"}`; gameplay also depends on this behavior.
- The model cold-starts slowly; increase `LLM_SMOKE_TIMEOUT_MS`.
- Network ACLs or proxy settings block the app host from reaching the LLM endpoint.

The smoke test intentionally prints only endpoint and model reachability, never the API key.

## Application Smoke Test Fails

Run:

```powershell
npm run smoke:app
```

Common causes:

- The service is not running, or `APP_SMOKE_BASE_URL` points to the wrong host.
- `HOST` is still `127.0.0.1` while testing from another machine.
- Rate limiting is too low for repeated checks from the same source IP.
- LLM request failures surface through `/api/game/ask`; run `npm run smoke:llm` to isolate the LLM layer.
- Scenario files are invalid or missing required reveal fields; run `npm test` and `npm run verify:deploy:offline`.

## Coworkers Cannot Access The Game

Use:

```env
HOST=0.0.0.0
```

Then ensure Windows Firewall or the server security group allows inbound traffic on `PORT`.

## Sessions Disappear

Sessions are currently in memory. Restarting the Node process clears active games.

## Players See 429 Errors

The API rate limiter is rejecting too many requests from the same client IP.

Check:

```text
GET /api/metrics
```

Look at `rateLimitedTotal`, `rateLimit.trackedClients`, and `responsesByStatus.429`.

If users are behind a shared proxy, raise:

```env
RATE_LIMIT_MAX_REQUESTS=300
```

For trusted load testing only, disable:

```env
RATE_LIMIT_MAX_REQUESTS=0
```

## LLM Queue Is Full

The internal LLM service cannot keep up with current gameplay traffic. Options:

Check:

```text
GET /api/metrics
```

Look at `llm.active`, `llm.queued`, `llm.failuresTotal`, and `llm.avgLatencyMs`.

- Increase `LLM_MAX_CONCURRENCY` if the LLM service can handle it.
- Increase `LLM_QUEUE_LIMIT` for short traffic bursts.
- Add a reverse proxy or shared queue before scaling to multiple Node processes.
