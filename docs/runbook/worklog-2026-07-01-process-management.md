# Worklog: Process Management

Date: 2026-07-01

## Work Completed

- Added Docker image healthcheck against `/api/health`.
- Added a systemd unit example for Linux intranet hosts without Docker.
- Added deployment configuration regression checks for Docker healthcheck, Compose restart policy, and systemd restart behavior.
- Added a process management runbook that defines Docker Compose as the preferred long-running path.
- Updated deployment, startup, README, and changelog docs.

## Files Changed

- `Dockerfile`
- `deploy/systemd/ops-turtle-soup.service.example`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/intranet-startup.md`
- `docs/runbook/process-management.md`
- `docs/changelog.md`
- `README.md`

## Test Results

```text
npm test
All tests passed
```

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

Docker CLI was not available on this machine, so Docker image build verification still needs to run on a host with Docker installed.

## Risks

- Docker build still depends on Docker being installed on the target host.
- The systemd file is an example and must be reviewed against the target Linux distribution paths.
- Sessions remain in memory, so any managed restart clears active games.

## Next Steps

- Verify Docker build on a host with Docker installed.
- Add external session storage if horizontal scaling or restart persistence becomes required.
