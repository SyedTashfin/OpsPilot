# Changelog

All notable changes to OpsPilot are documented here.

## v1.0.0 — RC1

Release date: 2026-06-27

### Added

- TypeScript pnpm monorepo with shared app/package boundaries.
- Docker Compose local stack for OpsPilot API, dashboard, demo service, PostgreSQL/pgvector, Ollama, and optional Langfuse.
- Deterministic BeautyCorp synthetic telemetry generator for services, deployments, logs, metrics, and incidents.
- Fastify API with health, services, logs, telemetry ingest, incident detection, runbook search, investigation creation, and investigation read/report endpoints.
- PostgreSQL schema, migrations, migration ledger, seed data, and local reset/seed/migrate scripts.
- Runbook RAG package with chunking, deterministic/Ollama embeddings, pgvector retrieval, and search CLI.
- LLM provider abstraction with Ollama default, optional Gemini, provider health, timeout handling, and deterministic demo LLM path.
- Single-agent investigation workflow with deterministic app-owned tool sequence and one structured JSON LLM generation.
- Application-owned persisted investigation read model and report endpoint.
- Optional Langfuse observability behind an `InvestigationObserver` boundary.
- Langfuse trace shape: one workflow trace, four tool observations, one LLM generation observation, and completion metadata.
- Production-style dark OpsPilot dashboard for overview, incidents, investigation detail, tool timeline, evidence, and Langfuse trace links.
- Portfolio-quality dashboard screenshots in `docs/assets/screenshots/issue-010-dashboard/`.
- End-to-end deterministic investigation demo script.
- Architecture documentation and ADRs for monorepo, database schema, RAG, LLM abstraction, and Langfuse observability.
- Release documentation: README, architecture index, changelog, release notes, release checklist, contributing guide, license, and version file.

### Changed

- V1 implementation planning moved from local Markdown issue files to GitHub Issues and GitHub Projects.
- Root package metadata now explicitly declares workspace dependencies used by root-level scripts.
- README rewritten as a first-time engineer landing page for v1.0.0.

### Verified

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm format:check`
- `pnpm docker:config`
- `pnpm docker:build`
- Docker Compose startup
- deterministic investigation demo
- Langfuse trace API smoke
- dashboard browser smoke

### Known limitations

- Synthetic demo data only.
- Docker Compose local deployment only.
- No evaluation framework in v1.0.0.
- No prompt management UI.
- No authentication, RBAC, multi-tenancy, remediation, Kubernetes, Terraform, or cloud deployment.
- Langfuse is optional and linked from the dashboard rather than embedded.
