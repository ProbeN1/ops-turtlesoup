# Worklog: Coworker Access Smoke

Date: 2026-07-01

## Work Completed

- Added `npm run smoke:coworker` for running a non-LLM access smoke from a coworker machine or another intranet segment.
- The smoke checks health, readiness, homepage loading, `app.js` loading, game start, reveal payload, and 100-player session capacity.
- Updated deployment docs, release checklist, release record template, README, changelog, and regression checks.

## Files Changed

- `package.json`
- `tests/coworker-access-smoke.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`
- `README.md`

## Test Results

```text
npm test
All tests passed
```

```text
node tests/coworker-access-smoke.js against a temporary local service
ok=true
maxActiveSessions=300
homepageLoaded=true
gameStarted=true
revealComplete=true
```

## Risks

- This smoke proves HTTP/API access from the machine where it is run. It does not replace a manual browser UI smoke for layout and interaction quality.
- It intentionally avoids the LLM ask path; keep `npm run smoke:llm` and `npm run load:llm` as separate release gates.

## Next Steps

- Run the smoke from an actual coworker intranet machine before sharing the game URL broadly.
