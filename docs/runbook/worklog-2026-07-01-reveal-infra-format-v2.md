# Worklog: Reveal Infrastructure Formatting V2

Date: 2026-07-01

## Work

- Fixed reveal rendering so infrastructure background is normalized before display.
- Added frontend fallback for bad server text such as `[object Object]`.
- Added frontend support for legacy `infra_background` reveal payloads.
- Bumped the `app.js` cache-busting query string so browsers load the fixed client code.

## Modified Files

- `public/app.js`
- `public/index.html`
- `tests/run-tests.js`
- `docs/changelog.md`

## Verification

- Passed: `npm test`

## Risk

- Low. The change is limited to reveal message formatting and static script versioning.

## Next

- Verify with automated tests and a focused reveal API/UI smoke if needed.
