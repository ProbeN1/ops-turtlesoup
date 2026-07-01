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
