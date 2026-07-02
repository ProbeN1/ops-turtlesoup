# Worklog: RCA Progress And Feedback UI

## Date

2026-07-02

## Work

- Added an RCA progress bar under the opening story.
- Added backend `progress` payloads for game start, ask, solved, and reveal flows.
- Kept progress non-spoiling: it returns percentage, label, and hint text only.
- Reworked the feedback contact area into stable contact cards so DingTalk and email copy actions do not drift out of the panel.
- Added regression checks for progress UI, reveal progress, and feedback contact card structure.

## Modified Files

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/feedback.html`
- `public/styles.css`
- `tests/run-tests.js`
- `docs/architecture.md`
- `docs/development.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: browser geometry check for `/feedback`; copy buttons stay inside the contact panel and there is no horizontal overflow.
- Passed: browser flow check for progress bar; start shows `0%` and reveal shows `100%`.

## Risks

- Progress is heuristic and can move up when players mention related terms without fully solving the chain.
- Progress intentionally does not list matched facts, so it gives confidence feedback without becoming a hint system.

## Next

- Run automated tests and browser visual checks, then deploy to the intranet host.
