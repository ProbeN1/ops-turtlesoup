# Worklog: Smoke Build Identity Checks

Date: 2026-07-01

## Work

- Added build identity assertions to `npm run smoke:app`.
- Added build identity assertions and output to `npm run smoke:coworker`.
- Added optional expected commit checks through `EXPECTED_RELEASE_GIT_COMMIT`, `APP_SMOKE_EXPECTED_GIT_COMMIT`, and `COWORKER_SMOKE_EXPECTED_GIT_COMMIT`.
- Updated release docs so target-host and coworker smoke evidence can prove the running service commit.

## Modified Files

- `tests/app-smoke.js`
- `tests/coworker-access-smoke.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`
- Passed: `npm run smoke:coworker` against a temporary local service on `127.0.0.1:5791`.
  - Output included `build.version=0.1.0` and `build.gitCommit=24c1a6e`.
- Diagnostic check: `npm run smoke:coworker` against the already-running `127.0.0.1:5725` service failed with `health endpoint missing build identity`, proving the smoke catches stale pre-upgrade processes.

## Risk

- Low. Expected commit checks are opt-in unless an expected commit environment variable is provided.

## Next

- Run the smoke tests on the target intranet host with `EXPECTED_RELEASE_GIT_COMMIT` set to the intended release commit.
