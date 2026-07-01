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

## LLM Returns HTML Or Invalid JSON

Verify `OPENAI_BASE_URL` ends with the OpenAI-compatible API prefix, usually `/v1`.

Example:

```env
OPENAI_BASE_URL=http://10.10.214.22:30002/v1
```

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

- Increase `LLM_MAX_CONCURRENCY` if the LLM service can handle it.
- Increase `LLM_QUEUE_LIMIT` for short traffic bursts.
- Add a reverse proxy or shared queue before scaling to multiple Node processes.
