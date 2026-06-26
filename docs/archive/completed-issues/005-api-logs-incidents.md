# Issue 5 — Implement Fastify API for services, logs, incidents

## Objective

Replace the HTTP placeholder with a Fastify API that exposes the V1 service, log, demo seed, telemetry ingest, and incident detection routes.

## Routes

- `GET /api/health`
- `GET /api/services`
- `GET /api/services/:serviceId`
- `GET /api/logs`
- `POST /api/logs/batch`
- `GET /api/incidents`
- `GET /api/incidents/:incidentId`
- `POST /api/demo/seed`
- `POST /api/demo/telemetry/batch`
- `POST /api/demo/detect-incident`

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:config
pnpm docker:build
```
