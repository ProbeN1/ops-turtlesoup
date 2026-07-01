# Worklog: Reveal Infrastructure API Compatibility

Date: 2026-07-01

## Work

- Changed reveal responses so `infraBackground` is display-ready text instead of a structured object.
- Added `infraBackgroundRaw` and `infra_background` for callers that need the original structured infrastructure background.
- Updated the frontend fallback order to prefer raw structured data only when formatted server text is missing or invalid.
- Bumped the frontend script version to force browsers to load the compatibility fix.

## Modified Files

- `server.js`
- `public/app.js`
- `public/index.html`
- `tests/run-tests.js`
- `docs/scenario-authoring.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`

## Risk

- Low. The reveal endpoint still exposes raw infrastructure data under explicit raw field names, while the legacy `infraBackground` field becomes safer for direct rendering.

## Next

- Verify the running intranet instance has been restarted after deploying this change.
