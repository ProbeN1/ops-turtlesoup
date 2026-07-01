# Worklog: Intranet Deploy To 10.10.214.4

Date: 2026-07-01

## Work

- Built a clean release archive from committed `HEAD` to avoid including local uncommitted scenario edits.
- Kept the release archive and checksum on the local workstation under `dist/`.
- Installed Node.js 24, npm, and unzip on the target Oracle Linux 8.10 host.
- Deployed the release under `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260701T064851Z`.
- Configured `/opt/ops-turtle-soup/current` as the active release symlink.
- Configured `/opt/ops-turtle-soup/.env` for intranet binding.
- Installed and enabled `ops-turtle-soup.service` as a systemd long-running service.
- Tuned `RATE_LIMIT_MAX_REQUESTS=0` on the target host so a 100-player intranet smoke is not blocked by single-source IP rate limiting.

## Release Artifact

- Local archive: `dist/ops-turtle-soup-0.1.0-20260701T064851Z.zip`
- Local checksum: `dist/ops-turtle-soup-0.1.0-20260701T064851Z.zip.sha256`
- SHA256: `0b5e652471857e3149f31ba89f652a4713b48f951fbfb40a54d077cb15eb7acd`
- Git commit: `96b3c6f`
- Release URL: `http://10.10.214.4:5725/`

## Verification

- Passed: clean-worktree `npm test`.
- Passed: clean-worktree `npm run build:release`.
- Passed: clean-worktree `npm run verify:release-archive`.
- Passed: remote SHA256 verification.
- Passed: systemd service active and enabled.
- Passed: remote `GET /api/health` with build commit `96b3c6f`.
- Passed: remote manual start, ask, and reveal API smoke.
- Passed: reveal infrastructure payload did not render `[object Object]`.
- Passed: remote `npm run load:local` with 100 users, 20 concurrency, 100 completed, and 0 rate-limited requests.
- Passed: remote `npm run evidence:process`; systemd active and port `0.0.0.0:5725` listening.
- Passed: workstation-to-host minimal coworker flow for homepage, latest `app.js`, game start, and reveal.

## Blocked Gates

- Failed: `/api/ready` reports `llm.apiKeyConfigured=false`.
- Failed: remote `npm run verify:deploy` because no `OPENAI_API_KEY` or `LLM_API_KEY` is configured.
- Failed: remote `npm run smoke:llm` because no `OPENAI_API_KEY` or `LLM_API_KEY` is configured.
- Failed: standard `npm run smoke:app` and `npm run smoke:coworker` because they require `/api/ready` to pass.

## Risk

- The web service is reachable and can run the local fallback flow, but it is not a final game release until a real LLM key is configured and the LLM smoke/load gates pass.
- Sessions are in memory and remain single-instance, matching the current documented architecture.

## Next

- Add a real `OPENAI_API_KEY` or `LLM_API_KEY` to `/opt/ops-turtle-soup/.env`.
- Restart `ops-turtle-soup.service`.
- Rerun `npm run verify:deploy`, `npm run smoke:llm`, `npm run smoke:app`, `npm run smoke:coworker`, `npm run load:llm`, and release evidence capture.
