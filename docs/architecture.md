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

Node server.js
  -> data/scenarios/*.json
  -> in-memory sessions
  -> OpenAI-compatible LLM API
```

## Runtime Components

- Frontend: vanilla HTML, CSS, and JavaScript.
- Backend: Node.js native `node:http`.
- Scenario data: JSON files under `data/scenarios`.
- Scenario cache: JSON scenario files are validated and cached in memory after first load.
- Session state: in-memory `Map`, with periodic cleanup.
- LLM provider: OpenAI-compatible `/chat/completions` endpoint.

## API Surface

- `GET /api/health`: process health and basic readiness.
- `GET /api/difficulties`: available difficulty options.
- `POST /api/game/start`: create a game session.
- `POST /api/game/ask`: answer a player question.
- `POST /api/game/reveal`: reveal answer for a session.

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

Known limits:

- Sessions are lost on process restart.
- Multiple Node instances would require shared session storage.
- LLM latency and rate limits are the primary throughput constraint.
