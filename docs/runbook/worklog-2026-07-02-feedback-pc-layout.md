# Worklog: Feedback PC Layout

## Date

2026-07-02

## Work

- Replaced the feedback contact area with dedicated `feedback-contact-list` and `contact-card` layout classes.
- Removed dependence on the old DingTalk-only contact style.
- Replaced ambiguous copy glyphs with readable `复制` buttons.
- Versioned `styles.css` in the game and feedback pages to force browsers to fetch the fixed layout.
- Reduced contact value font sizing so the DingTalk number does not wrap or look vertically misplaced on PC.

## Modified Files

- `public/index.html`
- `public/feedback.html`
- `public/styles.css`
- `tests/run-tests.js`
- `docs/changelog.md`

## Tests

- Passed: browser PC geometry check on `/feedback`; contact values and buttons stay inside each card.
- Passed: `npm test`

## Risks

- Users with an old open tab may need one refresh, but the stylesheet URL is now cache-busted for new loads.

## Next

- Deploy to the intranet host.
