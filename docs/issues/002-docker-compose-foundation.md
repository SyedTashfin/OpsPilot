# Issue 2 — Add Docker Compose foundation

## Objective

Create Docker Compose setup for OpsPilot app services, Postgres/pgvector, Ollama, and Langfuse self-hosting.

## Dependencies

- Issue 1 — Bootstrap TypeScript monorepo

## Acceptance criteria

- `docker compose` configuration validates.
- OpsPilot app images build for API, web, and demo-service.
- `opspilot-postgres` uses pgvector.
- Langfuse UI is configured for local port `3001`.
- Ollama is configured for port `11434`.
- `.env.example` documents required variables.
- `scripts/ollama/pull-models.sh` documents/pulls the default Qwen and embedding models.

## Deliverables

- `infra/compose/docker-compose.yml`
- `infra/compose/docker-compose.langfuse.yml`
- Dockerfiles for web/API/demo placeholders
- `.dockerignore`
- `.env.example` updates
- `docs/adr/0002-langfuse-observability.md`
- `scripts/ollama/pull-models.sh`

## Estimated effort

4–8 hours.
