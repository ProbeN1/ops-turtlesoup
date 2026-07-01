# Worklog: Release Archive Checksum

Date: 2026-07-01

## Work Completed

- Added SHA256 checksum generation to `npm run build:release`.
- The release builder now writes a sidecar `.sha256` file beside the zip and includes `sha256Path` and `sha256` in the JSON output.
- Updated deployment docs, release checklist, release record template, changelog, and regression checks.

## Files Changed

- `tests/build-release.js`
- `tests/run-tests.js`
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
sha256Path=dist/ops-turtle-soup-0.1.0-20260701T051625Z.zip.sha256
sha256=d186ab0ec952eb9038bea45f992778c3f3e749659b9d01b4e85b2e44d165083d
```

```text
Get-FileHash SHA256 comparison
match=true
```

## Risks

- The checksum proves archive integrity after transfer, but not that the target host executed the exact archive. Capture the checksum in the release record.

## Next Steps

- Verify the `.sha256` file after copying the archive to the target intranet host.
