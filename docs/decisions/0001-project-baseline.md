# 0001 Project Baseline

Date: 2026-07-01

## Decision

Use a lightweight Node.js single-process architecture with vanilla frontend assets for the first intranet-deployable version.

## Context

The project started as a minimum playable operations turtle soup game. The immediate goal is to support around 100 intranet users with low operational complexity.

## Consequences

- Deployment remains simple.
- No build step is required.
- In-memory sessions are acceptable for one process.
- Horizontal scaling later requires external session storage.
