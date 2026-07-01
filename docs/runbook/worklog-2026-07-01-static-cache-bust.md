# Worklog: Static Cache Bust

Date: 2026-07-01

## Work Completed

- Added `Cache-Control: no-store` to static file responses.
- Versioned the frontend `app.js` script URL after the infrastructure reveal formatting fix.
- Added server-formatted `infraBackgroundText` to reveal responses and made the frontend prefer it.
- Added regression checks so future UI fixes are not hidden by stale frontend assets.

## Files Changed

- `server.js`
- `public/index.html`
- `public/app.js`
- `tests/run-tests.js`
- `tests/app-smoke.js`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
API smoke
infraBackgroundText=platform: bare-metal kubernetes; ...
containsObjectObject=false
indexCache=no-store
appCache=no-store
appVersioned=true
```

## Risks

- Browser tabs that loaded the page before this change may still need a hard refresh once.

## Next Steps

- Re-run UI smoke after deploying to the target intranet host.
