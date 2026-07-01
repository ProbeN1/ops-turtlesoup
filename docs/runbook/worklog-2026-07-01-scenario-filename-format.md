# Worklog: Scenario Filename Format

## Date

2026-07-01

## Work

- Renamed scenario JSON files from `<id>.json` to `难度-编号-题目.json`.
- Kept each scenario's internal `id` stable for API/session logic.
- Updated local and deployment scenario validation to enforce the new readable filename format.
- Updated scenario authoring, intake, architecture, development docs, and changelog.

## Modified Files

- `data/scenarios/easy/*.json`
- `data/scenarios/medium/*.json`
- `data/scenarios/hard/*.json`
- `tests/run-tests.js`
- `tests/verify-deploy.js`
- `docs/architecture.md`
- `docs/development.md`
- `docs/scenario-authoring.md`
- `docs/scenario-intake.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: `npm run smoke:llm`
- Passed: `npm run build:release`
- Passed: `npm run verify:release-archive`
- Passed: remote `npm run verify:deploy:offline` with `/opt/ops-turtle-soup/.env`
- Passed: remote `npm run verify:deploy`
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725`
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`
- Passed after retry with `LLM_SMOKE_TIMEOUT_MS=60000`: remote `npm run smoke:llm`
- Passed: remote `npm run evidence:process`

## Deployment

- Built release `ops-turtle-soup-0.1.0-20260701T083806Z` from commit `39702ed`.
- Local zip: `dist/ops-turtle-soup-0.1.0-20260701T083806Z.zip`
- Local tarball: `dist/ops-turtle-soup-0.1.0-20260701T083806Z.tar.gz`
- SHA256 tarball: `f2cb7762a55ea3ea2ef3f174c9415b4864318315c4bdca67915091c5a94c5897`
- Uploaded and extracted the tarball to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260701T083806Z`.
- Verified the Linux host preserved a readable scenario filename such as `data/scenarios/easy/简单-001-健康的服务没有后端.json`.
- Updated `/opt/ops-turtle-soup/current` and `/opt/ops-turtle-soup/.env` release identity, then restarted `ops-turtle-soup.service`.
- Release URL: `http://10.10.214.4:5725/`
- Running build after deployment: `39702ed / ops-turtle-soup-0.1.0-20260701T083806Z`.

## Risks

- Chinese filenames require the deployment target and archive tooling to preserve UTF-8 paths.
- Restarting the service cleared in-memory active sessions on the target host.
- The first remote LLM smoke timed out at 15 seconds; retry passed with a 60 second smoke timeout, consistent with previous internal LLM slow-response observations.

## Next

- Monitor internal LLM latency during real play; scenario filename handling is verified locally and on the intranet host.
