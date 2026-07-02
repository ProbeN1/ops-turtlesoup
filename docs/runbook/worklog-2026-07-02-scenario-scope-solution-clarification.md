# Worklog: Scenario Scope And Solution Clarification

## Date

2026-07-02

## Work

- Added `scenario_scope` to the scenario schema.
- Marked existing scenarios as `delivery-fault`.
- Added the `solution-clarification` question-bank scope.
- Added a medium scenario for clarifying the customer sentence: `我要一个高可用数据库方案`.
- Added frontend selection for `交付故障` and `方案澄清`.
- Updated the game start API to filter random scenario selection by difficulty and scope.
- Added `/api/scenario-scopes` and exposed scope inventory through health/readiness checks.
- Updated smoke tests, deployment verification, scenario authoring, scenario intake, architecture, development, README, and UI smoke docs.

## Modified Files

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `data/scenarios/*/*.json`
- `tests/*.js`
- `docs/*.md`
- `docs/runbook/*.md`
- `README.md`

## Tests

- Passed: `npm test`
- Passed: browser UI flow on `http://127.0.0.1:5726/`; selecting `中等` + `方案澄清` starts the new high-availability database clarification scenario.
- Passed: `npm run verify:release-archive` for `ops-turtle-soup-0.1.0-20260702T075508Z.zip`.
- Passed: target-host `npm run verify:deploy` after switching `/opt/ops-turtle-soup/current`.
- Passed: remote API check that `medium` + `solution-clarification` starts `medium-004`.
- Passed: workstation `npm run smoke:coworker` against `http://10.10.214.4:5725`.
- Passed: workstation `npm run smoke:app` against `http://10.10.214.4:5725` with `APP_SMOKE_DIFFICULTY=medium` and `APP_SMOKE_SCENARIO_SCOPE=solution-clarification`.

## Risks

- `solution-clarification` currently has one medium scenario only, so selecting it with `easy` or `hard` returns a clear no-matching-scenarios error until those scopes get more content.
- The host prompt is still incident-oriented in wording; the new scenario's category, scope, and answer rules provide enough context for the LLM, but future clarification scenarios may benefit from more role-specific host prompt text.

## Next

- Add easy and hard `solution-clarification` scenarios if the team wants all difficulty/scope combinations to be playable.
