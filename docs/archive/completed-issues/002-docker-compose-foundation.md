# Issue 2 — Add Docker Compose foundation

## Objective

Create Docker Compose setup for OpsPilot app services, Postgres/pgvector, Ollama, and Langfuse self-hosting.

## Dependencies

Issue 1.

## Acceptance criteria

- `docker compose up` starts Postgres, Ollama, Langfuse dependencies, API placeholder, web placeholder.
- `opspilot-postgres` uses pgvector.
- Langfuse UI is reachable on local port `3001`.
- Ollama is reachable on port `11434`.
- `.env.example` documents required variables.
- `scripts/ollama/pull-models.sh` documents/pulls Qwen model.

## Estimated effort

4–8 hours.
