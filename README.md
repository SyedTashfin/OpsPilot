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
LLM_TIMEOUT_MS=90000
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

## Investigation workflow

Issue #8 adds the first single-agent investigation workflow. It is intentionally deterministic: the application loads the incident, queries logs, summarizes metrics, loads deployment context, retrieves runbook chunks, then makes exactly one LLM call with a structured JSON-output prompt.

```text
POST /api/incidents/:incidentId/investigations
GET /api/investigations/:investigationId
GET /api/investigations/:investigationId/report
```

The returned report contains `summary`, `probableRootCause`, `confidence`, `evidence[]`, `citedRunbooks[]`, and `recommendedNextDiagnostics`. The workflow does not perform remediation, infrastructure changes, autonomous retries, chat, memory, dashboard work, or evaluation. The read APIs are application-owned and do not depend on Langfuse.

## Langfuse observability

Issue #9 adds optional Langfuse tracing for the investigation workflow. Langfuse is additive: investigations, persistence, and API responses continue when Langfuse is disabled or unavailable.

Configure local Langfuse in `.env`:

```bash
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=<local-public-key>
LANGFUSE_SECRET_KEY=<local-secret-key>
LANGFUSE_BASE_URL=http://langfuse-web:3000
LANGFUSE_ENVIRONMENT=local
```

Disable tracing with either `LANGFUSE_ENABLED=false` or empty `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` values.

Expected trace shape:

- one `investigation.workflow` trace per investigation
- four tool observations: `query_logs`, `query_metrics`, `get_deployments`, `search_runbooks`
- one `investigation.llm_generation` observation
- completion metadata for confidence, cited runbooks, evidence count, status, and duration

The existing investigation APIs include `langfuseTraceId` when tracing is enabled:

```text
GET /api/investigations/:investigationId
GET /api/investigations/:investigationId/report
```

See `docs/architecture/langfuse-observability.md` for troubleshooting and the observability boundary.

## Running a Complete Investigation Demo

Issue 8.5 adds a no-manual-API-calls local demo command:

```bash
pnpm demo:investigation
```

The script resets the local database, runs migrations, seeds BeautyCorp, ingests runbooks, generates deterministic telemetry, detects the recommendation-service incident, executes the investigation, fetches the completed report, and prints a readable summary.

Required services and models:

- Postgres with pgvector available through `DATABASE_URL`.
- Ollama reachable through `OLLAMA_BASE_URL` when using the default `LLM_PROVIDER=ollama`.
- Default chat model pulled locally: `qwen2.5:7b-instruct`.

Typical local flow:

```bash
cp .env.example .env
pnpm docker:up
ollama pull qwen2.5:7b-instruct
DATABASE_URL=postgres://opspilot:opspilot@localhost:5432/opspilot \
OLLAMA_BASE_URL=http://localhost:11434 \
pnpm demo:investigation
```

For a faster runbook-ingestion smoke path, the script defaults RAG embeddings to deterministic embeddings unless `RAG_EMBEDDING_PROVIDER` is set. This keeps the demo focused on the investigation LLM call.

For deterministic CI/local smoke testing without waiting on a local model, set:

```bash
OPSPILOT_DEMO_FAKE_LLM=true pnpm demo:investigation
```

Leave `OPSPILOT_DEMO_FAKE_LLM` unset when you want the production-like path through the configured LLM provider.

Expected output includes:

- investigation ID
- incident title and service
- confidence
- summary
- probable root cause
- evidence bullets
- cited runbooks
- recommended next diagnostics

Troubleshooting:

- If Postgres connection fails, verify `pnpm docker:up` is running and `DATABASE_URL` points at the host-mapped Postgres port.
- If Ollama returns a missing-model error, run `ollama pull qwen2.5:7b-instruct` or set `OLLAMA_CHAT_MODEL` to a model you have pulled.
- If the model returns invalid JSON, OpsPilot persists the raw response, parser error, and timestamp in investigation steps for debugging.

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
- `docs/architecture/langfuse-observability.md`
- `docs/architecture/llm-provider-abstraction.md`
- `docs/architecture/runbook-rag.md`
