# Worklog: Scenario Intake And Host UI

Date: 2026-07-01

## Work

- Fixed `.env` parsing so a UTF-8 BOM before the first key does not hide `OPENAI_API_KEY`.
- Updated deployment, LLM, app, and load smoke scripts to parse BOM-prefixed `.env` files.
- Changed scenario storage to one JSON file per case under `data/scenarios/<difficulty>/<id>.json`.
- Migrated the existing six scenarios into individual JSON files.
- Kept legacy aggregate-file loading as a fallback when a difficulty directory does not exist.
- Disabled host hint output by forcing `nudge` to remain empty.
- Updated frontend chat rendering so it ignores `nudge` entirely.
- Improved collapsed chat UI by hiding the ask form and keeping the collapsed panel compact.
- Added `docs/scenario-intake.md` for converting raw incident information into scenario JSON.

## Modified Files

- `server.js`
- `public/app.js`
- `public/styles.css`
- `tests/run-tests.js`
- `tests/verify-deploy.js`
- `tests/llm-smoke.js`
- `tests/app-smoke.js`
- `tests/load-llm.js`
- `docs/architecture.md`
- `docs/development.md`
- `docs/deployment.md`
- `docs/scenario-authoring.md`
- `docs/scenario-intake.md`
- `data/scenarios/*/*.json`

## Verification

- Passed: `npm test`
- Passed: `npm run smoke:llm`
- Passed: temporary local service plus `npm run smoke:app`
- Passed: `npm run verify:deploy:offline`

## Risk

- Low to medium. Scenario loading changed from aggregate files to per-case files, but the server keeps a legacy aggregate-file fallback.
- LLM smoke now rejects non-empty `nudge`, so an incompatible model prompt response will fail early instead of leaking hints into gameplay.

## Next

- Build a new clean release archive.
- Deploy the updated build to `10.10.214.4`.
- Run standard release smoke checks with the real LLM key.
