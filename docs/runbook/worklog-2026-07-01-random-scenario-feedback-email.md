# Worklog: Random Scenario And Feedback Email

## Date

2026-07-01

## Work

- Confirmed each `POST /api/game/start` picks one scenario from the selected difficulty set.
- Switched scenario selection from `Math.random()` to `crypto.randomInt()` so the per-round random choice is explicit.
- Added `jiang.yi12@iwhalecloud.com` to the feedback page with a copy button.
- Updated feedback documentation and changelog.

## Modified Files

- `server.js`
- `public/feedback.html`
- `public/styles.css`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/development.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`

## Risks

- Random selection can still repeat the same scenario in consecutive rounds because the requirement is random choice, not no-repeat rotation.

## Next

- Build and deploy the release to the intranet host after tests pass.
