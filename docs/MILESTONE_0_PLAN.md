# Milestone 0 Plan: Safety Hardening and Evaluation Separation

Repository A (`SyedTashfin/OpsPilot`) is canonical for this work. Repository B (`SyedTashfin/opspilot-agentic-operations`) remains separate; histories are intentionally not merged. Milestone 0 does not port SSL functionality, does not deploy, and does not perform any cloud cutover.

## Source-grounded audit

- Package manager/workspaces: `package.json`, `pnpm-workspace.yaml`, and `turbo.json` define a pnpm/Turbo monorepo with `apps/*`, `packages/*`, and script tests under `scripts/**/*.test.ts`.
- Apps/packages: `apps/api` is the Fastify JSON API, `apps/web` serves static dashboard assets, `apps/demo-service` generates synthetic BeautyCorp telemetry, and packages cover contracts, database, domain, LLM, RAG, and telemetry.
- Fastify API: `apps/api/src/server.ts` registers health, incidents, investigations, logs, services, demo, runbooks, and LLM routes. `apps/api/src/config.ts` defaults to local Postgres and local Ollama.
- Static frontend: `apps/web/src/static/app.ts` fetches incidents, logs, services, and investigation reports; no auth is implemented yet.
- DB access/migrations: `packages/database/src/client.ts` creates `pg` pools; `packages/database/src/migrations.ts` runs migrations, seeds, and reset. Core schema is in `packages/database/migrations/0002_core_schema.sql`; synthetic seed/runbooks are in `0004_seed_beautycorp.sql`.
- Investigation workflow/prompt: `apps/api/src/modules/investigations/investigation.workflow.ts` loads incident/log/metric/deployment/runbook evidence, records tool outputs, builds `apps/api/src/modules/investigations/investigation.prompt.ts`, calls the LLM, validates JSON, and persists the final report.
- Fixtures/seeds/runbooks: `tests/fixtures/incidents/recommendation-service-latency.json`, `apps/demo-service/src/beautycorp/incident-scenarios.ts`, and `packages/database/migrations/0004_seed_beautycorp.sql` previously mixed observable incident state with answer-like text.
- Reset callers: direct exports from `@opspilot/database`, `scripts/db/reset.ts`, and `scripts/demo/run-investigation.ts` call `resetDatabase()`.
- Health/tests/skips: health routes exist in `apps/api/src/routes/health.routes.ts`; tests are Vitest-based with DB-independent unit coverage and integration tests that skip when `DATABASE_URL` is absent.
- Compose: `infra/compose/docker-compose.yml` defines local API/web/Postgres/Ollama/demo topology; Langfuse is optional via `docker-compose.langfuse.yml`.
- Auth/CORS/browser state/mutations/logging/docs/issues/milestones: no production auth or robust CORS boundary is present; browser state is in static JS; mutation routes include demo/incident investigation actions; logging/observability is local-first with optional Langfuse documentation.

## Implemented Task 1 changes

- Hidden expected-answer ground truth is separated into `apps/api/test/evaluation/recommendation-latency-ground-truth.test-support.ts`, outside production app/package imports.
- Runtime incident contracts and investigator/API incident payloads no longer expose `suspectedRootCause`; the existing nullable DB column remains for backward-compatible forward migration planning.
- Runbook seed text now describes diagnostic checks instead of revealing a common root cause or demo rollback answer.
- Deterministic evaluation harness in `apps/api/test/evaluation/harness.test-support.ts` records expected conclusion, actual conclusion, cited evidence, pass/fail, confidence, and unsupported claims. Routine tests use a fake LLM only; optional live-model evaluation can be added later as a manually invoked script that never runs in CI.
- `resetDatabase()` now enforces destructive safety before destructive SQL for every caller. It rejects missing/ambiguous environments, production labels, managed/hosted/remote targets, credential-bearing URL disclosure, and requires `OPSPILOT_ALLOW_DATABASE_RESET=local-dev-or-test` plus local/dev/test/CI host signals.

## Forward migration and proposed Milestone 0 follow-ups

- Add a forward migration to drop `incidents.suspected_root_cause` after compatibility review of any external consumers.
- Add health readiness/liveness hardening, auth/CORS policy, browser mutation safeguards, CI workflow, Playwright E2E, pgvector reconciliation, branding updates, governance docs, and cloud runbooks in later bounded tasks.
- CI design: install with pnpm, run format check, lint, typecheck, unit tests, DB-independent focused tests, build, and optional Docker Compose config validation. DB tests should use ephemeral local/CI Postgres only.
- E2E design: Playwright should use local containers, deterministic fake LLM, seeded synthetic telemetry, and assertions that hidden ground truth never appears in UI/network payloads.

## Security boundaries

- No production or managed database reset is allowed, even with the local/test override.
- Errors and logs expose only safe reset metadata; full URLs, usernames, passwords, and query strings are not included.
- Production code must not import `*.test-support.ts` hidden evaluation fixtures; they are only referenced from Vitest tests.
- No paid model calls, deployment, production access, Repository B access, or SSL work occurs in Milestone 0.

## Acceptance criteria

- Prompt/messages/tool outputs/API incident state omit hidden field names and expected root-cause strings while retaining realistic logs, metrics, deployments, topology, timestamps, errors, and diagnostic runbooks.
- Fake-LLM investigation output is evaluated against hidden ground truth via deterministic tests.
- Destructive reset rejects unsafe targets before SQL and all callers inherit the same implementation-boundary guard.
- Documentation remains concise, source-grounded, and explicit about deferred non-Task-1 work.

## Risks and rollback

- Risk: existing consumers may expect `suspectedRootCause`; mitigation is to keep the DB column temporarily while removing runtime serialization and plan a forward migration.
- Risk: reset guard may block a legitimate local setup with a custom Docker hostname; mitigation is to add a narrow tested host to the allowlist, not to weaken caller-side guards.
- Rollback: revert the focused commits; database schema remains backward-compatible because no destructive migration is included in Task 1.
