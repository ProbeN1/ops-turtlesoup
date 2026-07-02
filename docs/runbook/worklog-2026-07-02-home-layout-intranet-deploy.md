# Worklog: Home Layout Intranet Deploy

## Date

2026-07-02

## Work

- Built release `ops-turtle-soup-0.1.0-20260702T081904Z` from commit `3340673`.
- Verified the release zip checksum and forbidden-path checks.
- Created a Linux-friendly tarball because the Windows zip emitted backslash path separator warnings on the target host.
- Uploaded and extracted the release to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260702T081904Z`.
- Updated `/opt/ops-turtle-soup/current` and release identity in `/opt/ops-turtle-soup/.env`.
- Restarted `ops-turtle-soup.service`.
- Verified the update-log page and home page cache-busted stylesheet from the intranet URL.

## Modified Files

- `docs/changelog.md`
- `docs/runbook/worklog-2026-07-02-home-layout-intranet-deploy.md`

## Tests

- Passed: `npm run verify:release-archive` for `ops-turtle-soup-0.1.0-20260702T081904Z.zip`.
- Passed: target-host `npm run verify:deploy` after switching `/opt/ops-turtle-soup/current`.
- Passed: workstation `npm run verify:deploy` against `http://10.10.214.4:5725` with release build `3340673`.
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `easy/delivery-fault`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` for `medium/solution-clarification`.
- Passed: workstation `npm run load:local` against `http://10.10.214.4:5725` with 100 users, concurrency 20, 100 starts, 100 reveals, and zero rate-limit hits.
- Passed: target-host `npm run evidence:process`; systemd active, port `0.0.0.0:5725` listening, and long-running process evidence present.
- Passed: `GET /updates.html` returned 200 and contained `首页布局优化`; home page contained `/updates.html` and `/styles.css?v=20260702-home-layout-v1`.
- Blocked by external quota: `npm run smoke:llm` returned HTTP 429 from the internal LLM gateway, reporting a 5-hour usage limit and sub-account monthly spend limit until `2026-07-02 18:51:33`.

## Risks

- Live LLM capacity is not cleared for a 100-player event until the internal quota resets or an administrator raises the quota.
- Sessions remain in memory, so restart still clears active games.
- The final release URL is `http://10.10.214.4:5725/`.

## Next

- After the LLM quota resets, rerun `npm run smoke:llm` and a live `npm run load:llm` against the deployed service.
