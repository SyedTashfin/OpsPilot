# OpsPilot

[![CI](https://github.com/SyedTashfin/OpsPilot/actions/workflows/ci.yml/badge.svg)](https://github.com/SyedTashfin/OpsPilot/actions/workflows/ci.yml)

OpsPilot is a local-first AI operations copilot that investigates a synthetic production incident end-to-end: telemetry is generated, an incident is detected, runbooks are retrieved with RAG, a single LLM call produces a structured root-cause report, and the investigation is visualized in a dark engineering dashboard with optional Langfuse tracing.

The project is intentionally narrow and production-shaped. It is built to demonstrate AI engineering, observability, deterministic workflow design, provider abstraction, and release-quality local infrastructure without pretending to be a full enterprise incident platform.

![OpsPilot dashboard overview](docs/assets/screenshots/issue-010-dashboard/01-overview-page.png)

## Why this exists

Most AI demos stop at chat. OpsPilot shows the harder engineering layer around an AI system:

- deterministic orchestration before the model call
- typed provider abstraction for local/cloud LLMs
- RAG over operational runbooks
- persisted investigations and reports
- optional tracing that observes the system without becoming business logic
- reproducible Docker-based local demo

The fictional company is **BeautyCorp**. V1 focuses on one realistic incident: a recommendation-service latency spike after a feature-store timeout deployment.

## What V1 demonstrates

- **AI investigation workflow**: application-owned tool sequence, one structured LLM generation, persisted report.
- **Observability**: optional Langfuse trace per investigation with tool and generation observations.
- **RAG**: pgvector-backed runbook ingestion and retrieval.
- **Provider abstraction**: Ollama by default, Gemini optional, deterministic fake LLM for smoke tests.
- **Platform engineering**: Fastify API, PostgreSQL/pgvector, Docker Compose, typed TypeScript monorepo.
- **Dashboard**: production-style dark UI for incidents, evidence, tool timeline, root cause, confidence, and trace links.

Explicitly out of V1 scope: evaluation, prompt management, Kubernetes, Terraform, cloud deployment, multi-tenancy, RBAC, automatic remediation, multi-agent planning, and enterprise integrations.

## Architecture

```mermaid
flowchart LR
  Demo[BeautyCorp demo service] -->|logs metrics deployments incidents| API[Fastify API]
  Web[OpsPilot dashboard] -->|existing REST APIs| API
  API --> DB[(PostgreSQL + pgvector)]
  API --> RAG[Runbook RAG]
  RAG --> DB
  API --> LLM[LLM provider abstraction]
  LLM --> Ollama[Ollama / local model]
  LLM -. optional .-> Gemini[Gemini]
  API -. optional traces .-> Langfuse[Langfuse]
```

Investigation flow:

```mermaid
sequenceDiagram
  participant User as Dashboard/API caller
  participant API as Fastify API
  participant DB as PostgreSQL + pgvector
  participant RAG as Runbook RAG
  participant LLM as LLM Provider
  participant LF as Langfuse optional

  User->>API: POST /api/incidents/:id/investigations
  API->>DB: Load incident
  API->>DB: Query logs
  API->>DB: Query metrics
  API->>DB: Query deployments
  API->>RAG: Search runbooks
  RAG->>DB: Vector search
  API->>LLM: One structured JSON generation
  API->>DB: Persist steps, evidence, report
  API-->>LF: Trace workflow/tool/generation metadata
  API-->>User: investigationId + report
```

See [`docs/architecture/README.md`](docs/architecture/README.md) for the complete Mermaid diagram set.

## Screenshots

| Overview                                                                      | Incident detail                                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ![Overview](docs/assets/screenshots/issue-010-dashboard/01-overview-page.png) | ![Incident detail](docs/assets/screenshots/issue-010-dashboard/02-incident-detail.png) |

| Tool timeline                                                                          | Evidence                                                                      | Langfuse link                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ![Timeline](docs/assets/screenshots/issue-010-dashboard/03-investigation-timeline.png) | ![Evidence](docs/assets/screenshots/issue-010-dashboard/04-evidence-view.png) | ![Langfuse](docs/assets/screenshots/issue-010-dashboard/05-langfuse-trace-integration.png) |

## Quick start

Prerequisites:

- Node.js 22+
- pnpm 9.15.5
- Docker Desktop / Docker Engine

Install and run local quality checks:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start the complete local stack:

```bash
cp .env.example .env
pnpm docker:config
pnpm docker:build
pnpm docker:up
```

If a host Ollama process already uses port `11434`, override only the host port:

```bash
OLLAMA_PORT=11435 pnpm docker:up
```

Local endpoints:

| Service    | URL                      |
| ---------- | ------------------------ |
| Dashboard  | <http://localhost:3000>  |
| API        | <http://localhost:4000>  |
| Langfuse   | <http://localhost:3001>  |
| Ollama     | <http://localhost:11434> |
| PostgreSQL | `localhost:5432`         |

Stop the stack:

```bash
pnpm docker:down
```

## Run the V1 demo

The demo resets the local database, runs migrations, seeds BeautyCorp, ingests runbooks, generates deterministic telemetry, detects the incident, runs an investigation, and prints the report.

Fast deterministic smoke path:

```bash
OLLAMA_PORT=11435 pnpm docker:up
DATABASE_URL=postgres://opspilot:opspilot@localhost:5432/opspilot \
RAG_EMBEDDING_PROVIDER=deterministic \
OPSPILOT_DEMO_FAKE_LLM=true \
pnpm demo:investigation
```

Production-like local path through Ollama:

```bash
ollama pull qwen2.5:7b-instruct
DATABASE_URL=postgres://opspilot:opspilot@localhost:5432/opspilot \
OLLAMA_BASE_URL=http://localhost:11434 \
pnpm demo:investigation
```

Expected output includes:

- investigation ID
- incident title and service
- confidence
- summary
- probable root cause
- evidence bullets
- cited runbooks
- recommended next diagnostics

## Langfuse integration

Langfuse is optional. OpsPilot continues to run if it is disabled or unavailable.

Configured local defaults in `.env.example`:

```bash
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-opspilot-dev
LANGFUSE_SECRET_KEY=<local-secret-key>
LANGFUSE_BASE_URL=http://langfuse-web:3000
LANGFUSE_ENVIRONMENT=local
```

Disable tracing with either:

```bash
LANGFUSE_ENABLED=false
```

or by leaving the Langfuse credentials empty.

Expected trace shape:

- one `investigation.workflow` trace per investigation
- tool observations: `query_logs`, `query_metrics`, `get_deployments`, `search_runbooks`
- one `investigation.llm_generation` observation
- completion metadata: confidence, evidence count, cited runbooks, status, duration

The dashboard links to Langfuse by trace ID. It does not embed Langfuse.

## API surface

Core V1 endpoints:

```text
GET  /api/health
GET  /api/llm/status
GET  /api/incidents
POST /api/incidents/:incidentId/investigations
GET  /api/investigations/:investigationId
GET  /api/investigations/:investigationId/report
GET  /api/runbooks/search?q=feature%20store%20timeout&limit=5
```

The investigation report includes `summary`, `probableRootCause`, `confidence`, `evidence[]`, `citedRunbooks[]`, `recommendedNextDiagnostics[]`, and `langfuseTraceId` when tracing is enabled.

## Repository structure

```text
apps/
  api/            Fastify API and investigation workflow
  demo-service/   Deterministic BeautyCorp telemetry generator
  web/            Node-served dashboard HTML/CSS/JS
packages/
  contracts/      Shared schemas and DTOs
  database/       PostgreSQL/pgvector migrations and seed helpers
  domain/         Shared domain types
  llm/            LLM provider abstraction, Ollama, Gemini, timeouts
  rag/            Runbook ingestion, embeddings, vector retrieval
  telemetry/      Optional Langfuse observer boundary
scripts/
  db/             Migration, reset, seed CLIs
  demo/           End-to-end investigation demo
  rag/            Runbook ingestion/search CLIs
docs/
  architecture/   Diagrams and subsystem notes
  adr/            Architecture decision records
  assets/         Dashboard screenshots
infra/
  compose/        Docker Compose stack
  docker/         App Dockerfiles
```

## Environment variables

Most local defaults are in `.env.example`. Important variables:

| Variable                                      | Purpose                                          |
| --------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                                | PostgreSQL connection string                     |
| `API_AUTO_MIGRATE`                            | Run migrations on API startup in local Compose   |
| `LLM_PROVIDER`                                | `ollama` or `gemini`                             |
| `OLLAMA_BASE_URL`                             | Ollama API base URL inside/outside Docker        |
| `OLLAMA_CHAT_MODEL`                           | Chat model for investigations                    |
| `LLM_TIMEOUT_MS`                              | Provider timeout bound                           |
| `RAG_EMBEDDING_PROVIDER`                      | `ollama` or deterministic local smoke embeddings |
| `LANGFUSE_ENABLED`                            | Enable/disable optional tracing                  |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse credentials                             |
| `WEB_PUBLIC_API_URL`                          | Dashboard API URL                                |

`.env.example` contains local development secrets for self-hosted Langfuse only. Replace them before any non-local use.

## Quality gates

Release verification uses:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm docker:config
pnpm docker:build
```

The `lint`, `typecheck`, `test`, `build`, and `format:check` gates run automatically on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`), including a DB integration test that runs the full investigation workflow against Postgres/pgvector.

Additional RC smoke checks run:

- Compose startup
- deterministic investigation demo
- Langfuse trace API verification
- dashboard browser smoke via Playwright

## Known limitations

- Synthetic data only; no production integrations.
- One deterministic investigation path; no planner or multi-agent loop.
- No evaluation suite in V1.
- No prompt management UI.
- No authentication, RBAC, tenancy, audit log, or user management.
- Docker Compose local deployment only; no Kubernetes/cloud deployment.
- Local Langfuse credentials are development defaults.

## Roadmap

- **V2 production hardening**: CI workflows, auth-light, release automation, operational docs, richer smoke tests.
- **Evaluation**: golden incidents, regression scoring, answer quality checks, trace-linked evaluation reports.
- **Prompt management**: versioned prompts, prompt review workflow, model comparison.
- **Integrations**: real log/metric sources, issue tracker hooks, Slack/PagerDuty-style surfaces.
- **Enterprise**: RBAC, tenancy, audit logs, policy controls, deployment templates.

## Project management

GitHub Issues and the project board are the source of truth.

- Issues: <https://github.com/SyedTashfin/OpsPilot/issues>
- Project board: <https://github.com/users/SyedTashfin/projects/2>
- Workflow: [`docs/github-workflow.md`](docs/github-workflow.md)

## License

MIT. See [`LICENSE`](LICENSE).
