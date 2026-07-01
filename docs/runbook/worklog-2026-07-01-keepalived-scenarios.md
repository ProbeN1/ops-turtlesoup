# Worklog: Keepalived Floating IP Scenarios

## Date

2026-07-01

## Work

- Added three new operations turtle soup scenarios from Keepalived floating-IP HA test material.
- Added `easy-003` for Layer 2 network boundary issues during VIP takeover.
- Added `medium-003` for duplicate VRID interference in the same Layer 2 domain.
- Added `hard-003` for Keepalived `track_script` timeout driving VRRP groups into FAULT and blocking VIP takeover.
- Preserved the final operational workaround in the hard scenario: comment `vrrp_script` and `track_script`, run the container-link scripts from crontab, and keep Keepalived focused on VIP election.

## Source Material

- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\141.txt`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\142.txt`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\chk-olc-service.sh`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\chk-cg-restservice.sh`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\olc-as-cluster.sh`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\log141.log`
- `C:\Users\Ginger\Desktop\opencode\keepalive脚本及配置\log142.log`

## Modified Files

- `data/scenarios/easy/easy-003.json`
- `data/scenarios/medium/medium-003.json`
- `data/scenarios/hard/hard-003.json`
- `docs/changelog.md`

## Tests

- Passed: `npm test`
- Passed: `npm run smoke:llm`
- Passed: intranet `npm run verify:deploy`
- Passed: intranet `npm run smoke:llm`
- Passed after retry: intranet `npm run smoke:app`
- Passed: local coworker access smoke against `http://10.10.214.4:5725`

## Deployment

- Deployed release `ops-turtle-soup-0.1.0-20260701T081614Z` to `10.10.214.4`.
- Health endpoint reported git commit `69745aa` and 9 total scenario files after deployment.
- First remote `smoke:app` attempt hit one LLM request timeout after 30 seconds; retry passed with the same release and service remained active under systemd.

## Risks

- The first two scenarios are intentionally derived from the supplied root-cause descriptions, while the strongest direct log evidence is for the hard scenario's `VRRP_Script ... timed_out` and FAULT state.
- Internal IPs and hostnames are preserved because the game is intended for intranet training; do not publish these scenarios externally without sanitizing them.

## Next

- Monitor whether the internal LLM timeout recurs during real play; if it does, tune the smoke question, timeout, or model-side capacity separately from scenario content.
