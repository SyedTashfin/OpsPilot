# Issue 3 — Implement database migrations and seed schema

## Objective

Add PostgreSQL/pgvector migrations and deterministic BeautyCorp seed data for the V1 vertical slice.

## Acceptance criteria

- `pnpm db:migrate` applies all migrations.
- `pnpm db:reset` recreates the database from scratch.
- `pnpm db:seed` inserts BeautyCorp services and runbooks idempotently.
- pgvector extension is enabled.
- Basic database package tests cover migration loading and config validation.

## Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:config
pnpm docker:build
pnpm docker:up
pnpm db:reset
pnpm db:migrate
pnpm db:seed
pnpm docker:down
```

If local Ollama already uses port `11434`, run Docker with an alternate host port:

```bash
OLLAMA_PORT=11435 pnpm docker:up
```
