# Worklog: LLM Fallback Release Gates

## Date

2026-07-02

## Work

- Updated `npm run load:llm` to require `llm.fallbacksTotal` delta to stay at `0`.
- Added `metricsDelta.llmFallbacksTotal` to the LLM load output.
- Added Prometheus fallback counter presence to `npm run evidence:release`.
- Added `llm.fallbacksTotal`, `metricsDelta.llmFallbacksTotal`, and `prometheus.ops_turtle_soup_llm_fallbacks_total` to the release record template.
- Strengthened `npm run check:release-record` so final release records fail when LLM fallback counts are non-zero.

## Modified Files

- `tests/load-llm.js`
- `tests/release-evidence.js`
- `tests/check-release-record.js`
- `tests/run-tests.js`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Tests

- Passed: `npm test`.

## Risks

- This is a governance and verification change only; it does not change the currently deployed runtime.
- Final event readiness remains blocked until the internal LLM quota or balance is restored and live LLM smoke/load checks pass with zero failures and zero fallbacks.

## Next

- After the internal LLM quota is restored, rerun `npm run smoke:llm` and `npm run load:llm` against `http://10.10.214.4:5725`.
