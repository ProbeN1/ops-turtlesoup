# Worklog: Release Rehearsal Evidence Gates

Date: 2026-07-01

## Work Completed

- Added release archive generation to `npm run rehearse:release`.
- Added release evidence capture to `npm run rehearse:release`.
- Updated release documentation and regression checks so the one-command rehearsal covers archive, evidence, deployment verification, application smoke, and 100-session capacity smoke.

## Files Changed

- `tests/release-rehearsal.js`
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
npm run rehearse:release
ok=true
release archive build=pass
offline deployment preflight=pass
online deployment verification=pass
application smoke=pass
release evidence snapshot=pass
100-session local capacity smoke=pass
live LLM ask-path load smoke=skipped
```

Release rehearsal generated:

```text
dist/ops-turtle-soup-0.1.0-20260701T050532Z.zip
```

## Risks

- `npm run rehearse:release` now creates a zip under `dist/`; clean `dist/` after local verification if the archive is not being handed off.

## Next Steps

- Run the rehearsal on the target intranet host and keep the generated archive plus evidence JSON in the release record.
