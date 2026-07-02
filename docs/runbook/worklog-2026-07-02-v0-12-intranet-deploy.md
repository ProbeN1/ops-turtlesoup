# Worklog: v0.12 Intranet Deploy

## Date

2026-07-02

## Work

- Built release `ops-turtle-soup-0.1.0-20260702T095729Z` from commit `83cf275`.
- Verified release archive checksum and forbidden-path checks.
- Created Linux tarball `ops-turtle-soup-0.1.0-20260702T095729Z.tar.gz`.
- Uploaded and extracted the release to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260702T095729Z` on `10.10.214.4`.
- Updated `/opt/ops-turtle-soup/current` to the new release.
- Updated target-host release identity in `/opt/ops-turtle-soup/.env`.
- Restored `RATE_LIMIT_MAX_REQUESTS=120` after deployment verification.
- Restarted `ops-turtle-soup.service`.
- Performed a final restart after smoke tests to clear test game sessions.

## Modified Files

- `docs/changelog.md`
- `docs/runbook/worklog-2026-07-02-v0-12-intranet-deploy.md`

## Tests

- Passed: `npm test`.
- Passed: `npm run build:release`.
- Passed: `npm run verify:release-archive`.
- Passed: workstation `npm run verify:deploy` against `http://10.10.214.4:5725` with `HOST=0.0.0.0`.
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725` with expected commit `83cf275`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `easy/delivery-fault`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `medium/solution-clarification`.
- Passed: workstation static check for `v0.12`, sound toggle presence, silent sound-toggle source, and update-log entry.
- Passed: target-host `npm run evidence:process`; systemd active, `0.0.0.0:5725` listening, and long-running process evidence present.
- Passed: workstation `npm run evidence:release` against `http://10.10.214.4:5725`.
- Passed: final health check after cleanup restart; build commit `83cf275`, release name `ops-turtle-soup-0.1.0-20260702T095729Z`, active sessions `0`, max active sessions `300`, and rate limit `120`.

## Risks

- Live LLM requests still hit the internal LLM quota limit and fall back to local host rules. The game remains playable, but final event readiness still requires restored LLM quota and a live LLM load smoke with zero failures and zero fallback growth.
- Browser automation timed out during local visual inspection earlier in the feature change, so manual UI smoke remains required before a larger event.

## Next

- Ask the internal LLM owner to restore quota or balance.
- Run `npm run smoke:llm` and `npm run load:llm` after quota is restored.
- Run the manual UI smoke runbook from a coworker browser before sharing broadly.
