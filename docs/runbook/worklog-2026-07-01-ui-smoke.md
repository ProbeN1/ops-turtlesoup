# Worklog: UI Smoke Verification

Date: 2026-07-01

## Work Completed

- Ran a real browser UI smoke test against `http://127.0.0.1:5725/`.
- Verified difficulty selection, game start, yes/no question flow, chat collapse/expand, reveal rendering, solved flow, and celebration animation.
- Added a repeatable UI smoke runbook.
- Added UI smoke as a release checklist gate.
- Added regression checks that the release checklist and UI smoke runbook retain key browser validation steps.

## Files Changed

- `docs/runbook/ui-smoke.md`
- `docs/runbook/release-checklist.md`
- `README.md`
- `docs/changelog.md`
- `tests/run-tests.js`

## Test Results

```text
npm test
All tests passed
```

## Manual Browser Results

- Page title and H1: `运维海龟汤`.
- Medium game started successfully.
- Question returned allowed answer: `否`.
- Chat collapsed and expanded correctly.
- Reveal rendered infrastructure without `[object Object]`.
- Easy `/data` backup scenario solved through the UI.
- Celebration layer showed 28 pieces, then hid.
- Final status: `已破案`.

## Risks

- Standalone Playwright automation was not added because the bundled Playwright browser binary was not installed on this machine.
- UI smoke remains manual until browser binaries are available on the verification host.

## Next Steps

- Add `npm run smoke:ui` when a stable browser binary is available.
- Run the UI smoke from a coworker intranet machine before the actual event.
