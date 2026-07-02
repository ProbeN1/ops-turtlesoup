# Worklog: README Script Inventory Removal

## Date

2026-07-02

## Work

- Removed the maintainer script inventory from `README.md`.
- Kept operational and release commands in runbooks where maintainers can follow them during changes and releases.
- Updated `docs/changelog.md`.

## Modified Files

- `README.md`
- `docs/changelog.md`

## Tests

- Passed: `git diff --check`.
- Passed: `npm test`.

## Risks

- Low risk; this is documentation-only and does not affect runtime behavior.

## Next

- Run markdown/diff checks and commit the documentation cleanup.
