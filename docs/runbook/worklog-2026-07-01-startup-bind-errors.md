# Worklog: Startup Bind Errors

Date: 2026-07-01

## Work Completed

- Added explicit startup error handling for listen failures.
- Converted port conflicts into a clear `Startup failed: <host>:<port> is already in use` stderr message.
- Converted bind permission failures into a clear `Startup failed: permission denied` stderr message.
- Added a regression test that occupies a local port and verifies the service exits with a readable startup error.
- Updated deployment, troubleshooting, and changelog documentation.

## Files Changed

- `server.js`
- `tests/run-tests.js`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

The test suite includes a regression case that binds a temporary local port first, then verifies the app exits with a readable `Startup failed:` message when configured to reuse that port.

```text
npm run verify:deploy:offline
PASS validated 6 scenarios across 3 difficulty files
WARN health check skipped by --offline
```

## Risks

- The app still runs as a single process; this change improves startup diagnostics but does not add automatic port discovery for production.

## Next Steps

- Keep using deployment verification after changing `HOST` or `PORT`.
- Verify Docker image build on a host with Docker installed.
