# ADR 0002: Langfuse as the LLM observability backbone

## Status

Accepted

## Context

OpsPilot V1 must demonstrate LLMOps and observability without rebuilding generic trace, prompt, latency, token, metadata, and evaluation primitives.

## Decision

Run Langfuse through Docker Compose for local development and integrate OpsPilot with Langfuse for investigation traces, tool observations, LLM generation records, latency, token usage, prompt/completion history, and completion metadata.

## Rationale

Langfuse is open-source, self-hostable, and purpose-built for LLM observability and evaluation. Using it keeps OpsPilot focused on the product-specific AIOps workflow: incidents, logs, runbooks, investigations, and dashboard views.

## Consequences

- OpsPilot stores Langfuse trace identifiers and product summaries, not a duplicate observability backend.
- Langfuse is optional. Missing credentials or Langfuse outages must not block investigations, persistence, or API responses.
- Evaluation scores remain future work; Issue #9 only adds observability.
- Local development requires additional containers: Langfuse web, worker, Postgres, ClickHouse, Redis, and MinIO.
- Any future cloud deployment must replace local secrets before non-local use.
