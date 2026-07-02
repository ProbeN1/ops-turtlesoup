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
- `LLM_REQUEST_TIMEOUT_SECONDS must be >= 1`
- `REQUEST_LIMIT_BYTES must be >= 4096`
- `HTTP_REQUEST_TIMEOUT_SECONDS must be >= 5`
- `Startup failed: 0.0.0.0:5725 is already in use`
- `Startup failed: permission denied while binding 0.0.0.0:5725`

For validation errors, fix `.env`, then restart the service and run:

```powershell
npm run verify:deploy:offline
```

For port conflicts:

```powershell
netstat -ano | Select-String ':5725'
```

Stop the old process or configure a different `PORT`.

## Restart Or Stop Hangs

The app handles `SIGTERM` and `SIGINT` by closing the HTTP server and clearing background cleanup timers.

If a process manager reports slow shutdown:

- check `SHUTDOWN_GRACE_SECONDS`;
- check whether long-running LLM requests are still active through `GET /api/metrics`;
- inspect process logs for `Received SIGTERM` or `Graceful shutdown timed out`.

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

The smoke test first probes TCP connectivity to the configured LLM host and port, then calls `/chat/completions`. Interpret failures as:

- `TCP connect ... timed out`: route, firewall, security group, gateway listener, or VPN issue.
- `TCP connect ... failed`: port closed, host unreachable, DNS failure, or refused connection.
- `LLM HTTP request ... timed out`: TCP is reachable, but the HTTP gateway or model response is too slow; check gateway logs and `LLM_SMOKE_TIMEOUT_MS`.
- `LLM returned HTTP ...`: gateway reached but rejected the request, model, key, or payload.
- `LLM returned non-JSON` or invalid host JSON: endpoint is not OpenAI-compatible enough for gameplay.

## Application Smoke Test Fails

Run:

```powershell
npm run smoke:app
```

Common causes:

- The service is not running, or `APP_SMOKE_BASE_URL` points to the wrong host.
- `HOST` is still `127.0.0.1` while testing from another machine.
- Rate limiting is too low for repeated checks from the same source IP.
- LLM request failures trigger local host fallback through `/api/game/ask`; run `npm run smoke:llm` to isolate the LLM layer and inspect `llm.fallbacksTotal`.
- Scenario files are invalid or missing required reveal fields; run `npm test` and `npm run verify:deploy:offline`.

## Coworkers Cannot Access The Game

Use:

```env
HOST=0.0.0.0
```

Then ensure Windows Firewall or the server security group allows inbound traffic on `PORT`.

## Sessions Disappear

Sessions are currently in memory. Restarting the Node process clears active games.

## Players See Room Full 503 Errors

Players may receive HTTP `503` with `房间已满，请稍后再试` when active game sessions reach `MAX_ACTIVE_SESSIONS`.

Check:

```text
GET /api/ready
GET /api/metrics
```

Look at `ready.sessions.active`, `ready.sessions.maxActive`, `activeSessions`, `maxActiveSessions`, and `responsesByStatus.503`.

Options:

- Wait for inactive sessions to expire after `SESSION_TTL_MINUTES`.
- Increase `MAX_ACTIVE_SESSIONS` if the host has enough memory.
- Lower `SESSION_TTL_MINUTES` if abandoned games should be cleaned up sooner.

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

## LLM Fallbacks Increase

The app answers through the LLM first, then falls back to local scenario rules when the LLM returns an error, times out, returns invalid JSON, hits quota, or the local queue is full. Players should still receive `是`, `否`, or `无关`, but answer quality is more conservative.

Check:

```text
GET /api/metrics
GET /metrics
```

Look at `llm.failuresTotal`, `llm.fallbacksTotal`, `llm.active`, `llm.queued`, and `ops_turtle_soup_llm_fallbacks_total`.

Options:

- Run `npm run smoke:llm` from the app host to confirm gateway compatibility and quota.
- If the gateway returns 429, wait for quota reset or ask the administrator to raise the quota.
- If `llm.queued` is high, tune `LLM_MAX_CONCURRENCY` and `LLM_QUEUE_LIMIT`.
- Treat sustained fallback growth during an event as degraded mode, even if players are not seeing 500 errors.

## LLM Queue Is Full

When the in-process LLM queue is full, the app now uses local host fallback for `/api/game/ask` instead of returning a player-facing `503`. This keeps the game playable during short LLM bursts.

Check:

```text
GET /api/metrics
```

Look at `llm.active`, `llm.queued`, `llm.failuresTotal`, `llm.fallbacksTotal`, and `llm.avgLatencyMs`.

- Increase `LLM_MAX_CONCURRENCY` if the LLM service can handle it.
- Increase `LLM_QUEUE_LIMIT` for short traffic bursts.
- Lower game concurrency if sustained fallbacks make answers too conservative.
- Add a reverse proxy or shared queue before scaling to multiple Node processes.

## LLM Requests Time Out

The app aborts one runtime LLM request after `LLM_REQUEST_TIMEOUT_SECONDS`.

Check:

```text
GET /api/metrics
```

Look at `llm.failuresTotal` and `llm.avgLatencyMs`.

Options:

- Increase `LLM_REQUEST_TIMEOUT_SECONDS` if the model is slow but reliable.
- Lower `LLM_MAX_CONCURRENCY` if the LLM service is overloaded.
- Run `npm run smoke:llm` from the app host to isolate gateway connectivity and JSON compatibility.

## Monitoring Scrape Fails

Prometheus-compatible metrics are exposed at:

```text
GET /metrics
```

Check:

- The service URL and port are reachable from the monitoring host.
- The scrape path is `/metrics`, not `/api/metrics`.
- The response contains metric names prefixed with `ops_turtle_soup_`.
- `npm run verify:deploy` passes on the release host.
