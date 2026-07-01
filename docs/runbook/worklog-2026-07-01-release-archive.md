# Worklog: Release Archive

Date: 2026-07-01

## Work Completed

- Added `npm run build:release` to create a portable zip release archive under `dist/`.
- The archive includes application code, scenario data, docs, deployment examples, tests, and `.env.example`.
- The archive excludes `.env`, `.git`, `node_modules`, logs, and previous `dist` output.
- Added `RELEASE_MANIFEST.txt` to each staged release directory.
- Updated deployment docs, release checklist, release record template, README, changelog, and regression checks.

## Files Changed

- `package.json`
- `tests/build-release.js`
- `tests/run-tests.js`
- `README.md`
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
npm run build:release
ok=true
archivePath=dist/ops-turtle-soup-0.1.0-20260701T044656Z.zip
included=.env.example,Dockerfile,docker-compose.yml,package.json,README.md,server.js,data,deploy,docs,public,tests
excluded=.env,.git,node_modules,server.out.log,server.err.log,dist
```

Archive inspection found `RELEASE_MANIFEST.txt` and `server.js`, and did not find `.env`, server logs, or `node_modules`.

```text
npm run rehearse:release
ok=true
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

- The archive build uses PowerShell `Compress-Archive` on Windows and `zip` on non-Windows hosts. Non-Windows archive generation requires `zip` to be installed.

## Next Steps

- Copy the generated archive to the target host and verify deployment from the extracted contents.
