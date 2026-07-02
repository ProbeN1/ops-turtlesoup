# Worklog: LLM Fallback Intranet Deploy

## Date

2026-07-02

## Work

- Built release `ops-turtle-soup-0.1.0-20260702T083651Z` from commit `857e2ae`.
- Verified the release zip checksum and forbidden-path checks.
- Created and deployed Linux tarball `ops-turtle-soup-0.1.0-20260702T083651Z.tar.gz`.
- Uploaded and extracted the release to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260702T083651Z`.
- Updated `/opt/ops-turtle-soup/current` and release identity in `/opt/ops-turtle-soup/.env`.
- Restarted `ops-turtle-soup.service`.

## Modified Files

- `docs/changelog.md`
- `docs/runbook/worklog-2026-07-02-llm-fallback-intranet-deploy.md`

## Tests

- Passed: `npm test`.
- Passed: `npm run verify:release-archive` for `ops-turtle-soup-0.1.0-20260702T083651Z.zip`.
- Passed: target-host `npm run verify:deploy` after switching `/opt/ops-turtle-soup/current`.
- Passed: workstation `npm run verify:deploy` against `http://10.10.214.4:5725` with release build `857e2ae`.
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `easy/delivery-fault`; the ask path returned a legal host answer while the LLM quota was unavailable.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `medium/solution-clarification`.
- Passed: workstation `npm run load:local` against `http://10.10.214.4:5725` with 100 users, concurrency 20, at least 100 starts, 100 reveals, and zero rate-limit hits.
- Passed: target-host `npm run evidence:process`; systemd active, port `0.0.0.0:5725` listening, and long-running process evidence present.
- Passed: fallback metric evidence from `GET /api/metrics` and `GET /metrics`: `llm.failuresTotal=1`, `llm.fallbacksTotal=1`, and `ops_turtle_soup_llm_fallbacks_total` present.
- Blocked by external quota: direct `npm run smoke:llm` returned HTTP 429 from the internal LLM gateway, reporting a 7-day usage limit and insufficient main-account balance until `2026-07-06 15:46:41`.

## Risks

- The deployed app is playable in degraded local-rule mode, but final 100-player event readiness still requires live LLM quota and `npm run load:llm` with zero LLM failures.
- Local fallback is conservative and may answer `无关` where the LLM would infer a better yes/no from wider context.
- Sessions remain in memory, so restart still clears active games.

## Next

- Ask the internal LLM administrator to restore quota or balance, then rerun `npm run smoke:llm` and `npm run load:llm` against the deployed service.
