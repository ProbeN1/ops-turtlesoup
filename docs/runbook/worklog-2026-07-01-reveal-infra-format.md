# Worklog: Reveal Infrastructure Formatting

Date: 2026-07-01

## Work Completed

- Fixed reveal rendering when `infra_background` is a structured object.
- Added a frontend regression assertion to prevent direct object interpolation.
- Added scenario authoring guidance for precise turtle soup openings.
- Linked scenario authoring documentation from README and development docs.

## Files Changed

- `public/app.js`
- `tests/run-tests.js`
- `docs/scenario-authoring.md`
- `docs/development.md`
- `docs/changelog.md`
- `README.md`

## Test Results

```text
npm test
All tests passed
```

## Risks

- Infrastructure formatting currently preserves JSON field names instead of translating every key into Chinese labels.
- Frontend formatter is covered by static regression checks, not a browser DOM unit test.

## Next Steps

- Consider extracting frontend formatters into a small testable module if UI logic grows.
- Add scenario authoring validation for required opening details.
