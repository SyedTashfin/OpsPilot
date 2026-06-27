# Contributing to OpsPilot

OpsPilot v1.0.0 is a focused portfolio-grade AI operations copilot. Contributions should preserve the V1 engineering boundaries unless a maintainer explicitly approves new product scope.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm docker:up
```

Run quality gates before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm docker:config
pnpm docker:build
```

## Scope discipline

Do not mix unrelated changes. Keep PRs aligned to one concern:

- bug fix
- documentation correction
- release engineering
- focused implementation issue

For V1 maintenance, avoid adding:

- evaluation features
- prompt management
- Kubernetes/cloud deployment
- additional backend services
- autonomous remediation
- multi-agent planning

These belong in future roadmap issues.

## Architecture boundaries

- Investigation workflow remains deterministic and app-owned.
- LLM provider-specific code belongs in `packages/llm`.
- Langfuse integration belongs behind `packages/telemetry` observer boundaries.
- RAG retrieval belongs in `packages/rag`.
- Dashboard consumes existing API read models; it should not duplicate business logic.

## Pull request checklist

- [ ] Code or docs are scoped to one concern.
- [ ] Lint, typecheck, tests, build pass.
- [ ] Docker config/build still pass if infrastructure is touched.
- [ ] Docs are updated for user-visible behavior.
- [ ] No secrets or generated artifacts are committed.
- [ ] Screenshots are updated for dashboard UI changes.
