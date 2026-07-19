# Cloud Cutover Preparation Runbook

This is a preparation document only. Milestone 0 does not deploy OpsPilot, create cloud resources, access production, or port SSL.

## Current stack

- API: Fastify TypeScript app, build `pnpm --filter @opspilot/api build`, start `node apps/api/dist/main.js` after build.
- Web: lightweight Node-served TypeScript/HTML/CSS app, build `pnpm --filter @opspilot/web build`, start `node apps/web/dist/main.js` after build.
- Database: PostgreSQL with pgvector.
- RAG: runbook ingestion through `pnpm rag:ingest` after migrations and safe seed data.
- Demo data: synthetic BeautyCorp fixtures only.

## Provider options

Recommended low-cost topology for a later controlled demo:

1. One small container/service for the API.
2. One small container/service for the web server, or one combined internal service behind a reverse proxy if operationally simpler.
3. Managed PostgreSQL with pgvector support.
4. Optional local/self-hosted or disabled Langfuse; do not require it for the first public demo.
5. Model provider with strict cost controls, or local/Ollama only for non-public demonstrations.

Conservative alternatives: Fly.io, Render, Railway, Google Cloud Run, or a small VPS. Vercel is not assumed because the frontend is not Next.js and the API is a stateful Fastify service that needs PostgreSQL/pgvector access.

## Environment variables

Names only; never commit values.

Secrets:

- `DATABASE_URL`
- `OPSPILOT_PORTFOLIO_ACCESS_CODE`
- `OPSPILOT_SESSION_SECRET`
- `GEMINI_API_KEY` if Gemini is used
- `LANGFUSE_SECRET_KEY` if Langfuse is enabled

Non-secret configuration:

- `NODE_ENV`
- `PORT` / `API_PORT`
- `API_ALLOWED_ORIGINS`
- `OPSPILOT_AUTH_REQUIRED`
- `API_AUTO_MIGRATE`
- `LLM_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_CHAT_MODEL`
- `GEMINI_MODEL`
- `LLM_TIMEOUT_MS`
- `RAG_EMBEDDING_PROVIDER`
- `WEB_PUBLIC_API_URL`
- `LANGFUSE_ENABLED`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_ENVIRONMENT`

## Auth, CORS, and CSRF assumptions

- Production must set explicit `API_ALLOWED_ORIGINS` to the browser frontend origin.
- Wildcard production CORS is forbidden.
- Cookies must be HttpOnly and Secure in production.
- State-changing routes require a valid session, CSRF header, allowed Origin/Referer, and JSON content type.
- Prefer same-origin routing through a reverse proxy if possible; otherwise keep the explicit CORS allowlist narrow.

## Managed PostgreSQL+pgvector sequence

1. Create a new managed PostgreSQL instance with pgvector support.
2. Create the application database and least-privilege app user.
3. Store the managed `DATABASE_URL` only in the deployment secret store.
4. Run migrations exactly once through the migration runner against the new empty database.
5. Verify `schema_migrations` records all migrations, including `0007` and `0008`.
6. Run RAG ingestion after migrations.
7. Do not run `db:reset` or `resetDatabase()` against managed targets; the reset guard is designed to reject them.

## Seed/demo-data sequence

For public demo data, use only the safe seed path after migrations:

```bash
pnpm db:migrate
pnpm db:seed
pnpm rag:ingest
```

Do not run the destructive demo reset script against a managed database.

## Deployment order

1. Confirm governance gates and required checks are enabled.
2. Build all workspaces with `pnpm build`.
3. Provision the database and run migrations.
4. Seed synthetic demo data if the demo needs initial incidents/runbooks.
5. Deploy API with production auth/session/CORS variables.
6. Deploy web with `WEB_PUBLIC_API_URL` pointed at the API origin.
7. Run smoke and E2E checks.
8. Enable traffic only after go/no-go gates pass.

## Verification gates

Go only if all pass:

- `GET /api/health` reports the expected typed status and dependency map.
- Public read-only routes load as documented.
- Login establishes a session without exposing access codes or session secrets.
- Cross-origin forged mutations are rejected.
- Investigation creation, detail read, report read, and history listing work.
- RAG exact search returns ranked runbook results after `0008`.
- Dashboard renders health, incidents, history, evidence, timeline, and final report.
- No hidden expected-answer fixture appears before an investigation result.
- Logs do not contain credentials, cookies, auth headers, CSRF tokens, or model credentials.

No-go if any fail, if costs exceed the agreed free/low-cost budget, or if production secrets are missing/weak.

## Cold starts and operations

- Expect cold starts on free/low-cost container platforms.
- Keep LLM timeouts bounded with `LLM_TIMEOUT_MS`.
- Use health checks to distinguish HTTP reachability from degraded/unhealthy dependencies.
- Configure application logs to avoid secrets and raw prompt/state dumps.

## Backup, restore, rollback, deletion

- Enable automated database backups before public traffic.
- Test restoring to a separate database before relying on backups.
- Roll back application code by redeploying the prior container/image; do not assume migrations auto-roll back.
- Roll back data by restoring a backup or applying a reviewed forward migration.
- Deletion requires disabling traffic, deleting app services, deleting managed database snapshots according to retention policy, and removing secrets from the provider.

## Human-only future actions

A human owner must supply production credentials, enable paid/free-tier cloud accounts, approve environment protections, enable GitHub security settings where supported, and decide whether/when to add SSL. Codex must not perform those actions in Milestone 0.
