# Worklog: Build Identity Evidence

Date: 2026-07-01

## Work

- Added non-sensitive build identity to runtime health, readiness, and metrics payloads.
- Added `RELEASE_INFO.json` to release archives.
- Added build identity to release evidence output and release record template.
- Added Docker build args and Compose args for non-sensitive release identity when deploying containers.
- Updated deployment and architecture documentation to describe version and commit traceability.

## Modified Files

- `server.js`
- `Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `tests/build-release.js`
- `tests/verify-release-archive.js`
- `tests/release-evidence.js`
- `tests/verify-deploy.js`
- `tests/check-release-record.js`
- `tests/run-tests.js`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`
- Passed: `npm run build:release`
- Passed: `npm run verify:release-archive`
- Partial: `npm run rehearse:release`
  - Passed before failure: release archive build, release archive verification, offline deployment preflight, online deployment verification.
  - Failed at application smoke because the configured LLM endpoint timed out while connecting to `10.10.214.22:30002`.
- Failed due external dependency: `npm run smoke:llm`
  - Result: configured LLM endpoint was unreachable from this machine during this run.

## Risk

- Low. The exposed build identity contains package name, package version, git commit, release name, and release creation time only. It does not include secrets or LLM endpoint URLs.

## Next

- Verify generated archives include `RELEASE_INFO.json`.
- Capture target-host release evidence and compare `build.gitCommit` with the intended release commit.
- Re-run `npm run smoke:llm` and `npm run rehearse:release` after the internal LLM endpoint is reachable again.
