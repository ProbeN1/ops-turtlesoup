# Architecture

## Overview

Ops Turtle Soup is a single-process Node.js web application for an operations incident mystery game.

```text
Browser
  -> public/index.html, public/app.js, public/styles.css
  -> /api/difficulties
  -> /api/game/start
  -> /api/game/ask
  -> /api/game/reveal
  -> /api/metrics
  -> /metrics

Node server.js
  -> data/scenarios/<difficulty>/<difficulty-label>-<number>-<title>.json
  -> in-memory sessions
  -> OpenAI-compatible LLM API
```

## Runtime Components

- Frontend: vanilla HTML, CSS, and JavaScript.
- Backend: Node.js native `node:http`.
- Scenario data: one JSON file per scenario under `data/scenarios/<difficulty>/`.
- Scenario cache: JSON scenario files are validated and cached in memory after first load.
- Session state: in-memory `Map`, with periodic cleanup.
- LLM provider: OpenAI-compatible `/chat/completions` endpoint.
- LLM protection: in-process concurrency limiter and bounded queue.
- Feedback page: static DingTalk contact and copyable feedback template.
- API protection: per-client sliding-window request limit.
- Runtime metrics: in-memory counters exposed as JSON at `/api/metrics` and Prometheus text at `/metrics`.
- Build identity: non-sensitive package version, git commit, release name, and release creation time exposed in health, readiness, metrics, and release evidence.

## API Surface

- `GET /api/health`: process health, build identity, and basic runtime status.
- `GET /api/ready`: build identity and deployment readiness checks for LLM configuration, scenario loading, limiter settings, and rate-limit settings.
- `GET /api/metrics`: build identity and JSON operational counters for intranet hosting.
- `GET /metrics`: Prometheus-format runtime counters for monitoring scrape jobs.
- `GET /api/difficulties`: available difficulty options.
- `POST /api/game/start`: create a game session.
- `POST /api/game/ask`: answer a player question.
- `POST /api/game/reveal`: reveal answer for a session.

Game start, ask, and reveal responses include a non-spoiling `progress` object for the frontend RCA progress bar. It contains only a percentage and short status text, not the matched hidden clues.

## Scenario Model

Each scenario follows the standard schema documented in [development.md](development.md).

Difficulty values are:

- `easy`
- `medium`
- `hard`

The API also accepts legacy `simple` as an alias for `easy`.

## Scaling Target

The current target is intranet deployment for around 100 concurrent players.

Current approach:

- Single Node process.
- Stateless frontend.
- Lightweight in-memory sessions.
- Session TTL cleanup to avoid unbounded memory growth.
- Scenario data is cached after first use to avoid repeated disk reads.
- LLM calls are limited by `LLM_MAX_CONCURRENCY` and `LLM_QUEUE_LIMIT`.
- Basic per-client API rate limiting protects the single Node process.

Known limits:

- Sessions are lost on process restart.
- Multiple Node instances would require shared session storage.
- LLM latency and rate limits are the primary throughput constraint.
