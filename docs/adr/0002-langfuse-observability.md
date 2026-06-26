# ADR 0002: Langfuse as the LLM observability backbone

## Status

Accepted

## Context

OpsPilot V1 must demonstrate LLMOps and observability without rebuilding generic trace, prompt, latency, token, metadata, and evaluation primitives.

## Decision

Run Langfuse through Docker Compose for local development and integrate OpsPilot with Langfuse for LLM traces, prompt executions, responses, latency, token usage, metadata, tool observations, and evaluation scores.

## Rationale

Langfuse is open-source, self-hostable, and purpose-built for LLM observability and evaluation. Using it keeps OpsPilot focused on the product-specific AIOps workflow: incidents, logs, runbooks, investigations, and dashboard views.

## Consequences

- OpsPilot stores Langfuse trace/score identifiers and product summaries, not a duplicate observability backend.
- Local development requires additional containers: Langfuse web, worker, Postgres, ClickHouse, Redis, and MinIO.
- Any future cloud deployment must replace local secrets before non-local use.
