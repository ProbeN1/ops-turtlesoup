# Worklog: Release Rehearsal Command

Date: 2026-07-01

## Work Completed

- Added `npm run rehearse:release` for one-command local release rehearsal.
- The rehearsal starts a temporary local service on an available port.
- It runs offline deployment preflight, online deployment verification, application smoke, and the 100-session local capacity smoke.
- It can optionally run the live LLM ask-path load smoke with `REHEARSAL_RUN_LLM=1`.
- Updated development, deployment, release checklist, release record template, and changelog documentation.

## Files Changed

- `package.json`
- `tests/release-rehearsal.js`
- `tests/run-tests.js`
- `docs/development.md`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
npm run rehearse:release
ok=true
baseUrl=http://127.0.0.1:6966
runLlm=false
offline deployment preflight=pass
online deployment verification=pass
application smoke=pass
100-session local capacity smoke=pass
```

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- The default rehearsal skips live LLM load to avoid accidental model traffic.
- Docker build and coworker-machine access still require target environment verification.

## Next Steps

- Run the rehearsal on the release host and paste the summary into a release record.
- Set `REHEARSAL_RUN_LLM=1` for an agreed LLM capacity rehearsal.
