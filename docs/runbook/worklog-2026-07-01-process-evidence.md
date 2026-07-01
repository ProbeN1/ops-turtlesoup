# Worklog: Process Evidence Capture

Date: 2026-07-01

## Work

- Added `npm run evidence:process` to capture non-sensitive process evidence from a release host.
- The evidence includes runtime build identity, target URL, listening port status, and available Docker Compose, systemd, or Windows Scheduled Task status.
- Updated release checklist, release record template, deployment docs, and changelog so process evidence is a release gate.

## Modified Files

- `package.json`
- `tests/process-evidence.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`
- Passed: `npm run evidence:process` against a temporary local service on `127.0.0.1:5792`.
  - Captured `build.version=0.1.0`, `build.gitCommit=2ec7186`, and `port.listening=true`.
- Diagnostic check: `npm run evidence:process` against the already-running `127.0.0.1:5725` service failed with `health endpoint missing build.version`, proving stale pre-upgrade services are rejected.

## Risk

- Low. The script does not print environment variables or secrets. It truncates command output and records only process-manager status and health/build identity.

## Next

- Run this command on the target intranet host and paste the JSON summary into the release record.
