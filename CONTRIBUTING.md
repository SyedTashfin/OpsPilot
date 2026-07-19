# Contributing to OpsPilot

OpsPilot is developed in SyedTashfin/OpsPilot. Keep changes focused and reviewable.

## Local workflow

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
pnpm security:scan
```

DB-backed tests require a local PostgreSQL+pgvector database and explicit safe reset signals; otherwise they remain gated for CI.

```bash
NODE_ENV=test \
CI=true \
OPSPILOT_ALLOW_DATABASE_RESET=local-dev-or-test \
OPSPILOT_RUN_DB_TESTS=true \
DATABASE_URL=postgres://opspilot:opspilot@localhost:5432/opspilot_test \
pnpm test:db
```

Playwright E2E requires installed Playwright browsers and a local/CI PostgreSQL+pgvector database:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Boundaries

- Do not modify Repository B (`SyedTashfin/opspilot-agentic-operations`) as part of OpsPilot changes.
- Do not port SSL functionality in Milestone 0.
- Do not deploy, access production resources, use production credentials, or make paid model calls from routine tests.
- Do not edit historical checksum-tracked migrations; add forward migrations.
