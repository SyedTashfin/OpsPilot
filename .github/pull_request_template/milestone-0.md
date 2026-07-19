## Summary

-

## Safety checklist

- [ ] Scope is limited to SyedTashfin/OpsPilot.
- [ ] No production deploy, managed DB access, paid model call, Repository B change, or SSL port.
- [ ] State-changing API routes remain protected by auth/CSRF/CORS checks.
- [ ] Hidden evaluation fixtures are not imported by production source.
- [ ] Historical migrations were not edited; new DB changes are forward migrations.
- [ ] Destructive reset safety remains enforced inside `resetDatabase()`.

## Validation

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm docs:check`
- [ ] `pnpm security:scan`
- [ ] DB-gated tests in CI or local PostgreSQL+pgvector
- [ ] `pnpm test:e2e` where Playwright/browser dependencies are installed
