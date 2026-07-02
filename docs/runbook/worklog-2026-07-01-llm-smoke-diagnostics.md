# Worklog: LLM Smoke Diagnostics

Date: 2026-07-01

## Work

- Added a TCP connectivity preflight to `npm run smoke:llm`.
- Improved LLM smoke failure messages so release operators can distinguish network reachability, HTTP timeout, gateway rejection, and model JSON compatibility failures.
- Documented how to interpret LLM smoke failures during release verification.

## Modified Files

- `tests/llm-smoke.js`
- `tests/run-tests.js`
- `docs/troubleshooting.md`
- `docs/deployment.md`
- `docs/changelog.md`

## Verification

- Passed: `npm test`
- Diagnostic failure captured: `npm run smoke:llm`
  - Current result: TCP connect to the internal LLM gateway timed out after 5000ms.
  - Interpretation: the configured LLM gateway port is not reachable from this machine during this run.

## Risk

- Low. The smoke test still sends the same chat completion request after the preflight and does not print API keys.

## Next

- Run the smoke test against the current internal LLM endpoint and capture the more precise failure or success evidence.
