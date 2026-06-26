# ADR 0001: TypeScript pnpm monorepo

## Status

Accepted

## Context

OpsPilot V1 is a vertical-slice AI engineering portfolio project. It contains a Next.js web dashboard, a Fastify API, a synthetic demo service, and shared packages for domain types, API contracts, LLM providers, RAG, telemetry, and database access.

These parts must evolve together while preserving strict TypeScript boundaries and deployable increments after every issue.

## Decision

Use a `pnpm` workspace monorepo managed with Turborepo.

The workspace layout is:

- `apps/web` for the Next.js dashboard
- `apps/api` for the Fastify API
- `apps/demo-service` for BeautyCorp synthetic data generation
- `packages/domain` for pure domain models
- `packages/contracts` for shared Zod/API contracts
- `packages/llm` for Ollama/Gemini provider abstractions
- `packages/rag` for runbook chunking and retrieval
- `packages/telemetry` for Langfuse/OpenTelemetry helpers
- `packages/database` for migrations and database access

## Rationale

- A monorepo keeps API contracts, domain types, and LLM/telemetry interfaces synchronized.
- `pnpm` workspaces are lightweight and deterministic.
- Turborepo gives a simple task runner for build, lint, typecheck, and test without adding runtime complexity.
- TypeScript project references are intentionally deferred until package boundaries become heavier; V1 starts with per-package `tsconfig.json` files extending the root base config.

## Consequences

Positive:

- Shared contracts reduce frontend/backend drift.
- Strict root TypeScript settings enforce production-quality code from the start.
- Future Docker builds can target individual apps cleanly.

Negative:

- The root repository has more setup than a single app.
- Workspace scripts must stay disciplined so each issue remains independently verifiable.

## Alternatives considered

### Separate repositories

Rejected because V1 needs rapid coordinated changes across web, API, contracts, and LLM instrumentation.

### Single Next.js full-stack app

Rejected because the approved architecture requires a Fastify backend and a cloud-ready service boundary.

### npm or yarn workspaces

Rejected because `pnpm` is already part of the approved architecture and gives stricter dependency isolation.
