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

Explicitly out of scope for V1:

- Kubernetes
- Terraform
- ArgoCD
- multi-tenancy
- multiple agents
- automatic remediation
- approval workflows
- complex RBAC
- cloud deployment

## Repository status

Issue #1 bootstraps the TypeScript monorepo and does not yet implement the runtime product. Each future issue must leave the repository linted, typechecked, tested, documented, and runnable.

## Prerequisites

- Node.js 22+
- Corepack-enabled pnpm (`corepack pnpm` works even if `pnpm` is not on PATH)
- Docker Desktop, starting with Issue #2

## Local development

```bash
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Docker Compose foundation

Issue #2 adds local Docker Compose infrastructure for the V1 vertical slice:

- OpsPilot scaffold services: web (`3000`), API (`4000`), demo-service (`4100`)
- PostgreSQL with pgvector (`5432`)
- Ollama (`11434`)
- Langfuse web (`3001`) plus worker, Langfuse Postgres, ClickHouse, Redis, and MinIO

Validate Compose configuration:

```bash
pnpm docker:config
```

Build the OpsPilot app images:

```bash
pnpm docker:build
```

Start the full local stack:

```bash
pnpm docker:up
```

Stop it:

```bash
pnpm docker:down
```

Pull the default local AI models after Ollama is running:

```bash
./scripts/ollama/pull-models.sh
```

The Langfuse development bootstrap credentials in `.env.example` are intentionally insecure and must not be reused outside local development.

## Architecture source of truth

The frozen V1 architecture is documented in:

- `docs/adr/0001-monorepo.md`
- `docs/issues/001-bootstrap-monorepo.md`

Future architecture docs will be added as the corresponding issues are implemented.
