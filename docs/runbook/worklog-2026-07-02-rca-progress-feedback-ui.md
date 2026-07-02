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
- Passed: `npm run build:release`
- Passed: `npm run verify:release-archive`
- Passed: remote `npm run verify:deploy:offline`
- Passed: remote `npm run verify:deploy`
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725`
- Passed: intranet API progress check; start returns `0%`, reveal returns `100%`.

## Deployment

- Built release `ops-turtle-soup-0.1.0-20260702T072304Z` from commit `48d2997`.
- Local zip: `dist/ops-turtle-soup-0.1.0-20260702T072304Z.zip`
- Local tarball: `dist/ops-turtle-soup-0.1.0-20260702T072304Z.tar.gz`
- SHA256 tarball: `1bffd4d45256cdb6104391a6e4d121916cc63369945ee9a39f654ae8f2514718`
- Uploaded and extracted the tarball to `/opt/ops-turtle-soup/releases/ops-turtle-soup-0.1.0-20260702T072304Z`.
- Updated `/opt/ops-turtle-soup/current` and `/opt/ops-turtle-soup/.env` release identity, then restarted `ops-turtle-soup.service`.
- Release URL: `http://10.10.214.4:5725/`
- Running build after deployment: `48d2997 / ops-turtle-soup-0.1.0-20260702T072304Z`.

## Risks

- Progress is heuristic and can move up when players mention related terms without fully solving the chain.
- Progress intentionally does not list matched facts, so it gives confidence feedback without becoming a hint system.

## Next

- Watch real-player feedback to tune progress thresholds and keyword coverage.
