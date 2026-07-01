# Worklog: Fixed Chat Window

## Date

2026-07-01

## Work

- Removed the chat collapse control that changed the conversation panel height.
- Converted the chat panel into a fixed embedded window with header, scrollback, and ask form rows.
- Kept the question input and ask button anchored at the bottom while messages scroll inside `chat-log`.
- Updated frontend regression assertions for the fixed-window behavior.

## Modified Files

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `tests/run-tests.js`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: `npm run smoke:llm`
- Passed: browser layout check on local service `http://127.0.0.1:5730/`; the ask button and ask form kept identical coordinates after starting and revealing a game.

## Risks

- On very small screens the page becomes vertically scrollable, but the chat input remains fixed within the chat window.

## Next

- Deploy to the intranet host after tests and browser checks pass.
