# OpsPilot

OpsPilot is a local-first AI operations copilot MVP for investigating synthetic production incidents at the fictional company **BeautyCorp**.

The V1 product is intentionally narrow: a demo microservice emits logs, an incident is detected, one AI agent investigates logs and runbooks, and the result is shown in a web dashboard with Langfuse-backed observability.

## V1 scope

Included in V1:

- Next.js dashboard
- Fastify API
- PostgreSQL with pgvector
- Ollama/Qwen as the default local LLM provider
- Optional Gemini provider
- Langfuse tracing/evaluation integration
- Docker Compose-only local infrastructure
- Synthetic BeautyCorp services and incidents

Explicitly out of scope for V1: Kubernetes, Terraform, ArgoCD, multi-tenancy, multiple agents, automatic remediation, approval workflows, complex RBAC, and cloud deployment.

## Prerequisites

- Node.js 22+
- pnpm 9.15.5
- Docker Desktop / Docker Engine

## Local development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker Compose

Issue #2 adds the local container foundation:

```bash
cp .env.example .env
pnpm docker:config
pnpm docker:build
pnpm docker:up
```

Primary local endpoints once containers are running:

- OpsPilot web placeholder: <http://localhost:3000>
- OpsPilot API placeholder: <http://localhost:4000>
- Langfuse UI: <http://localhost:3001>
- Ollama: <http://localhost:11434>
- OpsPilot Postgres: `localhost:5432`

If a host Ollama process already occupies port `11434`, keep the internal Compose service name unchanged and override only the host port:

```bash
OLLAMA_PORT=11435 pnpm docker:up
```

Pull local models explicitly when needed:

```bash
./scripts/ollama/pull-models.sh
```

## Database migrations

Issue #3 adds PostgreSQL/pgvector migrations and deterministic BeautyCorp seed data:

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

When running against the local Compose database from the host, use the `DATABASE_URL` from `.env.example` or export it in your shell before invoking the scripts.

## BeautyCorp demo service

Issue #4 adds deterministic synthetic data generation for the fictional company **BeautyCorp**. The demo service generates services, deployments, logs, metrics, and the first recommendation-service latency incident scenario. It includes a real telemetry posting client for the API ingest route that lands in Issue #5, while keeping startup posting opt-in so the Docker stack remains healthy before that route exists.

## API

Issue #5 replaces the placeholder API with Fastify routes for health, services, logs, demo telemetry ingest, and V1 incident detection. Local Docker startup runs migrations automatically by default through `API_AUTO_MIGRATE=true`; set it to `false` if you want to manage migrations explicitly.

## LLM providers

Issue #7 adds the `@opspilot/llm` provider abstraction. Ollama is the default local provider and Gemini is optional.

Local defaults are configured in `.env.example`:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b-instruct
```

For host-local development outside Docker, use `OLLAMA_BASE_URL=http://localhost:11434`. Pull the default model before running provider smoke checks:

```bash
ollama pull qwen2.5:7b-instruct
```

Gemini stays disabled unless both are set explicitly:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
```

API health surface:

```text
GET /api/llm/status
```

## Runbook RAG

Issue #6 adds repeatable runbook ingestion and pgvector retrieval for investigation context. Default embeddings use Ollama; deterministic embeddings are available only for local smoke tests.

```bash
pnpm rag:ingest
pnpm rag:search "feature store timeout recommendation latency"
```

API search endpoint:

```text
GET /api/runbooks/search?q=feature%20store%20timeout&limit=5
```

## Project management

GitHub Issues are the source of truth for implementation planning and execution. Do not use local Markdown issue files as the primary task tracker.

- Issues: <https://github.com/SyedTashfin/OpsPilot/issues>
- Project board: <https://github.com/users/SyedTashfin/projects/2>
- Workflow: `docs/github-workflow.md`
- Historical completed Markdown issue files: `docs/archive/completed-issues/`

## Architecture source of truth

- `docs/adr/0001-monorepo.md`
- `docs/adr/0002-langfuse-observability.md`
- `docs/architecture/database-schema.md`
- `docs/architecture/llm-provider-abstraction.md`
- `docs/architecture/runbook-rag.md`
