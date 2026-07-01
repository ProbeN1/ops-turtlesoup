# Worklog: Release Archive Verifier

Date: 2026-07-01

## Work

- Added `npm run verify:release-archive` for release zip integrity and content checks.
- Integrated archive verification into `npm run rehearse:release`.
- Added regression checks that the verifier validates checksum sidecars, required files, manifest entries, and forbidden paths.
- Updated deployment, release checklist, release record template, README, and changelog documentation.

## Modified Files

- `package.json`
- `tests/verify-release-archive.js`
- `tests/release-rehearsal.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `README.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`
- Passed: `npm run build:release`
- Passed: `npm run verify:release-archive`
- Passed: `npm run rehearse:release`

## Risk

- Low. The verifier reads and extracts generated archives into a temporary directory and removes that directory afterward.

## Next

- Run the full verification sequence and commit the release archive verifier changes.
