# Worklog: Release Record Completeness Check

Date: 2026-07-01

## Work Completed

- Added `npm run check:release-record` to validate a filled release record before approval.
- The script checks required summary fields, key evidence fields, unselected option placeholders, and common sensitive text patterns.
- Updated deployment docs, release checklist, README, changelog, and regression checks.

## Files Changed

- `package.json`
- `tests/check-release-record.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/changelog.md`
- `README.md`

## Test Results

```text
npm test
All tests passed
```

```text
RELEASE_RECORD_PATH=docs/runbook/release-record-check-test.md node tests/check-release-record.js
okCode=0
okPassed=true
```

```text
same record with OPENAI_API_KEY appended
badCode=1
badFailedOnSecret=true
```

## Risks

- The check is intentionally strict and may require operators to fill fields that are not applicable for unusual release modes.

## Next Steps

- Run `npm run check:release-record` before marking a target-host release approved.
