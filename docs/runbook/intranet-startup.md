# Intranet Startup Runbook

## Steps

1. Configure `.env`.
2. Ensure `HOST=0.0.0.0` for coworker access.
3. Ensure `PORT` is allowed by firewall.
4. Start the service:

```powershell
npm start
```

5. Verify health:

```powershell
Invoke-RestMethod http://127.0.0.1:5725/api/health
```

6. Run deployment verification:

```powershell
npm run verify:deploy
```

7. Run the LLM smoke test:

```powershell
npm run smoke:llm
```

8. Run the application smoke test:

```powershell
npm run smoke:app
```

9. Share:

```text
http://<server-intranet-ip>:5725/
```

## Offline Preflight

Before starting the service, validate local runtime configuration and scenario files:

```powershell
npm run verify:deploy:offline
```
