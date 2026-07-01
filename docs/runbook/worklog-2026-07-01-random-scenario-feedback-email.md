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
- Passed: `npm run build:release`
- Passed: `npm run verify:release-archive`
- Passed: remote `npm run verify:deploy:offline`
- Passed: remote `npm run verify:deploy`
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`
- Passed: feedback page contains `0027029145`, 姜毅, and `jiang.yi12@iwhalecloud.com`
- Blocked by internal LLM quota: workstation `npm run smoke:app` ask path returned HTTP 500 from upstream LLM 429.

## Deployment

- Built release `ops-turtle-soup-0.1.0-20260701T085244Z` from commit `f7bf65f`.
- Local zip: `dist/ops-turtle-soup-0.1.0-20260701T085244Z.zip`
- Local tarball: `dist/ops-turtle-soup-0.1.0-20260701T085244Z.tar.gz`
- SHA256 tarball: `a5581cfe80b5f98f6f5fd4baabd8b3f832f385dbceb3c42a9b7915ccf924b7d8`
- Uploaded and extracted the tarball to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260701T085244Z`.
- Updated `/opt/ops-turtle-soup/current` and `/opt/ops-turtle-soup/.env` release identity, then restarted `ops-turtle-soup.service`.
- Release URL: `http://10.10.214.4:5725/`
- Running build after deployment: `f7bf65f / ops-turtle-soup-0.1.0-20260701T085244Z`.

## Risks

- Random selection can still repeat the same scenario in consecutive rounds because the requirement is random choice, not no-repeat rotation.
- Restarting the service cleared in-memory active sessions on the target host.
- The live ask-path smoke is blocked until the internal LLM quota resets. The upstream message reported reset time `2026-07-01 17:23:55`.

## Next

- Re-run `npm run smoke:app` after the internal LLM quota resets.
