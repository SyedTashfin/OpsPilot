# ADR 0002: Langfuse as the LLM observability backbone

## Status

Accepted

## Context

OpsPilot V1 must demonstrate LLMOps and observability without rebuilding generic LLM tracing, prompt execution, evaluation, latency, token usage, and metadata storage from scratch.

The approved architecture requires Langfuse from the beginning and restricts V1 to Docker Compose only.

## Decision

Use self-hosted Langfuse in the local Docker Compose environment.

OpsPilot will send LLM traces, prompt executions, tool observations, metadata, and evaluation scores to Langfuse. OpsPilot's own database will store only product-facing investigation summaries and Langfuse trace/score identifiers needed by the dashboard.

## Rationale

- Langfuse is purpose-built for LLM tracing, prompt management, evaluations, latency, usage, and metadata.
- Reusing Langfuse avoids building a weaker parallel observability system.
- Self-hosted Docker Compose keeps V1 local-first and low-cost.
- The application dashboard can stay focused on BeautyCorp incidents and investigation evidence.

## Consequences

Positive:

- Strong LLMOps story from the start.
- Cleaner application schema because generic trace storage lives in Langfuse.
- Future cloud deployment can keep the same observability contract.

Negative:

- Local Compose has more infrastructure services: Postgres, ClickHouse, Redis, and MinIO.
- Development credentials in `.env.example` are intentionally insecure and must not be reused for production.

## Scope boundaries

V1 does not implement a custom trace explorer, prompt registry, or evaluation store beyond product-facing summaries and links to Langfuse traces.
