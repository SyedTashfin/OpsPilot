# Issue 4 — Build BeautyCorp synthetic demo service

## Objective

Implement deterministic synthetic BeautyCorp data generation for the V1 vertical slice.

## Delivered scope

- Five fictional BeautyCorp services.
- Synthetic deployments.
- Structured logs.
- Synthetic metrics.
- One deterministic recommendation-service latency incident scenario.
- A real HTTP client for posting telemetry batches to the API once Issue #5 exposes the ingest route.

## Runtime behavior

The demo-service container remains healthy before Issue #5 by logging a heartbeat. To post a generated telemetry snapshot on startup, set:

```bash
DEMO_SERVICE_POST_ON_START=true
```

The client posts to:

```text
POST /api/demo/telemetry/batch
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:config
pnpm docker:build
```
