# Process Management Runbook

Use this runbook when moving the game from local testing to a shared intranet host.

## Recommended Path: Docker Compose

Use Docker Compose when the host can run containers.

```bash
docker compose up -d
docker compose ps
docker compose logs -f ops-turtle-soup
```

Expected behavior:

- the container restarts automatically through `restart: unless-stopped`;
- Docker health status is based on `/api/health`;
- `.env` is loaded by Compose;
- only one Node process is started, preserving the current in-memory session model.

Stop:

```bash
docker compose down
```

Update:

```bash
git pull
docker compose up -d --build
npm run verify:deploy
npm run smoke:llm
npm run smoke:app
```

## Linux Host Without Docker: Systemd

Use `deploy/systemd/ops-turtle-soup.service.example` as the starting point.

Checklist:

- copy the project to `/opt/ops-turtle-soup`;
- create an `ops-turtle-soup` system user;
- place the production `.env` at `/opt/ops-turtle-soup/.env`;
- copy the example unit to `/etc/systemd/system/ops-turtle-soup.service`;
- run `systemctl enable --now ops-turtle-soup`;
- run deployment verification and smoke tests.

Useful commands:

```bash
sudo systemctl status ops-turtle-soup
sudo journalctl -u ops-turtle-soup -f
sudo systemctl restart ops-turtle-soup
```

## Windows Host

For Windows intranet hosts, prefer Docker Compose if Docker is approved. If Docker is not available, use an approved service wrapper such as NSSM or a managed process platform already used by the team.

Minimum requirements:

- run from the project directory so `.env`, `data`, and `public` resolve correctly;
- start `node server.js` on boot;
- redirect stdout and stderr to retained log files;
- restart on process failure;
- run `npm run verify:deploy`, `npm run smoke:llm`, and `npm run smoke:app` after installation.

Avoid using an interactive PowerShell window as the long-running production process.

## Operational Notes

- Keep a single application instance unless session storage is externalized.
- Restarting the process clears active games because sessions are in memory.
- For around 100 players, the LLM endpoint remains the main capacity dependency.
- If users share one proxy IP, tune `RATE_LIMIT_MAX_REQUESTS` before the event.
