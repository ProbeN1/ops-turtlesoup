# Worklog: Intranet Redeploy To 10.10.214.4 V2

Date: 2026-07-01

## Work

- Built a clean release archive from commit `85b016f`.
- Deployed `ops-turtle-soup-0.1.0-20260701T071142Z` to `10.10.214.4`.
- Updated `/opt/ops-turtle-soup/current` to the new release.
- Rewrote `/opt/ops-turtle-soup/.env` from the local `.env` with BOM-safe parsing and without printing secrets.
- Restarted `ops-turtle-soup.service`.

## Release Artifact

- Local archive: `dist/ops-turtle-soup-0.1.0-20260701T071142Z.zip`
- Local checksum: `dist/ops-turtle-soup-0.1.0-20260701T071142Z.zip.sha256`
- SHA256: `493d7bc035e4b0920c76d80c624b98a519df8b99f803d6a1aed1fafd477e4c1b`
- Git commit: `85b016f`
- Release URL: `http://10.10.214.4:5725/`

## Verification

- Passed: clean-worktree `npm test`.
- Passed: clean-worktree `npm run build:release`.
- Passed: clean-worktree `npm run verify:release-archive`.
- Passed: local `npm run smoke:llm`.
- Passed: local temporary service plus `npm run smoke:app`.
- Passed: remote SHA256 verification.
- Passed: remote `npm run verify:deploy`.
- Passed: remote `npm run smoke:llm`.
- Passed: remote `npm run smoke:app`.
- Passed: remote `npm run evidence:process`.
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`.
- Passed: remote `npm run load:llm` with 10 users, 2 concurrency, 0 LLM failures, and p95 ask latency 6143 ms.

## Result

- The standard readiness gate is now green.
- The deployed service is running under systemd and listening on `0.0.0.0:5725`.
- The running build identity is `85b016f / ops-turtle-soup-0.1.0-20260701T071142Z`.

## Risk

- LLM capacity was verified with a small 10-user smoke, not a full 100-user simultaneous LLM ask-path load.
- Sessions remain in memory and single-instance, as documented.

## Next

- If the event expects many simultaneous LLM questions, run a larger `LLM_LOAD_USERS` and `LLM_LOAD_CONCURRENCY` test during a quiet window.
