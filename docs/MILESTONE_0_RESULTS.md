# Milestone 0 Results

## Scope implemented

Milestone 0 hardens the canonical `SyedTashfin/OpsPilot` repository while preserving a local-first, user-triggered synthetic incident demo. Repository B remains separate and untouched; SSL work is deferred.

Implemented areas:

- Source-grounded Milestone 0 plan.
- Hidden evaluation ground-truth separation and answer-leakage regression tests.
- Safe seed SQL and forward migrations `0007` and `0008` without editing historical migrations.
- Destructive `resetDatabase()` guard at the implementation boundary.
- Typed health contract shared by API and dashboard.
- Portfolio-demo auth, restricted CORS, CSRF protection, JSON-only mutation checks, logout protection, and rate limiting.
- Typed paginated investigation history API and dashboard history browsing.
- pgvector exact-search schema reconciliation.
- GitHub quality workflow, Dependabot config, governance docs, and deterministic docs/secret checks.
- Playwright E2E scaffolding with an E2E-only deterministic API launcher.
- Cloud cutover preparation runbook only; no deployment.

## Security boundaries

- Hidden evaluation fixtures live outside production API source and build output.
- Runtime incident/API payloads omit `suspectedRootCause`.
- Model-visible state and pre-LLM browser DOM are tested for absence of answer leakage.
- State-changing routes require auth/session/CSRF/origin/content-type checks.
- Production CORS requires explicit non-wildcard origins.
- Destructive reset rejects production, managed, remote, ambiguous, and non-OpsPilot database targets before SQL.
- Secret scanner checks tracked source content for common committed-secret patterns without printing matched values.

## Migration/data status

- Historical checksum-tracked migrations remain immutable.
- `0007_sanitize_synthetic_evaluation_leakage.sql` sanitizes synthetic answer leakage for existing DBs.
- `0008_drop_runbook_ivfflat_index.sql` removes the unused ANN index for V1 exact-search behavior while preserving vector columns, documents, chunks, and embeddings.
- `packages/database/seeds/beautycorp.sql` is the current safe seed path.

## Local validation run by Codex

Latest successful local aggregate command:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm docs:check && pnpm security:scan && git diff --check
```

Observed local test summary included:

- Workspace tests passed.
- API tests: 5 files passed, 1 DB-gated file skipped locally; 27 passed, 1 skipped.
- Database tests: 3 files passed; 15 passed, 1 DB-gated pgvector test skipped locally.
- Web tests: 2 files passed; 11 passed.
- Scripts tests: 4 files passed; 9 passed.
- Docs check: 22 Markdown files checked after final documentation commit.
- Secret scan: 187 tracked files checked after final documentation commit.

## Checks awaiting GitHub CI or external local services

- `pnpm install --frozen-lockfile --ignore-scripts` accepted the lockfile but could not fetch Playwright in Codex because the npm registry returned 403.
- `pnpm test:e2e` could not run in Codex because Playwright was not installed due the registry 403.
- `pnpm test:db` with `OPSPILOT_RUN_DB_TESTS=true` could not run in Codex because no local PostgreSQL+pgvector service was available; the GitHub workflow defines the isolated service container.
- `pnpm audit --audit-level=high --prod` returned 403 from the npm audit endpoint in Codex.

## Governance status

Committed:

- `.github/workflows/quality.yml`
- `.github/dependabot.yml`
- `.github/CODEOWNERS`
- `.github/pull_request_template/milestone-0.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `docs/REPOSITORY_GOVERNANCE_SETUP.md`

Not enabled by Codex:

- Branch protection.
- Required checks.
- Secret scanning or push protection.
- Dependabot alerts/security updates.
- Production deployment environments.
- CodeQL/private code scanning.

## Rollback notes

- Code rollback: revert Milestone 0 commits or redeploy the previous application artifact after review.
- Database rollback: do not edit applied migrations; use backup restore or a reviewed forward migration.
- Seed rollback: restore prior seed behavior only in a forward-safe way and do not reintroduce answer leakage.

## Deferred items

- SSL port from Repository B.
- Production cloud deployment.
- Repository setting changes requiring owner permissions.
- Real production credentials/accounts.
- Non-synthetic integrations and autonomous remediation.
