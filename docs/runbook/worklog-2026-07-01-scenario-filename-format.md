# Worklog: Scenario Filename Format

## Date

2026-07-01

## Work

- Renamed scenario JSON files from `<id>.json` to `难度-编号-题目.json`.
- Kept each scenario's internal `id` stable for API/session logic.
- Updated local and deployment scenario validation to enforce the new readable filename format.
- Updated scenario authoring, intake, architecture, development docs, and changelog.

## Modified Files

- `data/scenarios/easy/*.json`
- `data/scenarios/medium/*.json`
- `data/scenarios/hard/*.json`
- `tests/run-tests.js`
- `tests/verify-deploy.js`
- `docs/architecture.md`
- `docs/development.md`
- `docs/scenario-authoring.md`
- `docs/scenario-intake.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: `npm run smoke:llm`

## Risks

- Chinese filenames require the deployment target and archive tooling to preserve UTF-8 paths.

## Next

- Verify release archive and intranet deployment after tests pass.
