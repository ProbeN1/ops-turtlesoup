# Changelog

## 2026-07-01

- Initialized Git project governance.
- Added documentation structure.
- Migrated scenario data to standard JSON scenario schema.
- Added `/api/health`.
- Added session TTL cleanup and request body limit.
- Added schema and frontend binding tests.
- Added Docker and docker compose deployment files.
- Added intranet deployment target for around 100 users.
- Added in-memory scenario cache.
- Added `npm run load:local` for 100-session local capacity smoke testing.
- Added LLM concurrency limiter and bounded queue.
- Added basic per-client API rate limiting.
- Added load-test server mode for local capacity smoke tests.
- Fixed reveal rendering for structured infrastructure background.
- Added scenario authoring guidance for precise turtle soup openings.
- Added deployment verification commands for intranet readiness checks.
- Added live LLM smoke test for OpenAI-compatible host JSON responses.
- Added application smoke test for health, start, ask, and reveal API flow.
- Added Docker healthcheck, systemd example, and process management runbook for long-running intranet hosting.
- Added intranet release checklist for pre-share deployment gates.
- Added `/api/metrics` runtime counters for request volume, game flow, rate limiting, and LLM latency.
