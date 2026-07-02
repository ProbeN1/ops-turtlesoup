# Worklog: Home Layout And Update Log

- Date: 2026-07-02
- Work content: Refined the game home controls, tightened the main viewport layout, added an update log page, and exposed the update log above feedback in the version badge.
- Modified files: `public/index.html`, `public/styles.css`, `public/feedback.html`, `public/updates.html`, `tests/run-tests.js`, `docs/changelog.md`, `docs/runbook/ui-smoke.md`.
- Tests: `npm test` passed; browser check at 1280x720 confirmed the home shell fits the viewport, controls stay in the requested rows, and `updates.html` opens successfully.
- Risk: Very small viewports may still need page scrolling because the game keeps a usable embedded chat window.
- Next step: Commit the change and deploy the next intranet release when ready.
