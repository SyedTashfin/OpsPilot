# Langfuse Observability

Issue #9 adds optional Langfuse observability for the V1 investigation workflow.

## Boundary

OpsPilot owns the product workflow:

- incident loading
- log, metric, deployment, and runbook queries
- LLM provider abstraction
- investigation persistence
- API read/report endpoints

Langfuse owns observability:

- investigation traces
- tool observations
- LLM generation records
- prompt/completion history
- token usage metadata
- future evaluation surfaces

Langfuse is not required for the investigation to succeed. When Langfuse is disabled, missing, or unavailable, OpsPilot continues the workflow and persistence path normally.

## Configuration

Langfuse is enabled only when credentials are present and `LANGFUSE_ENABLED` is not `false`.

```bash
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-opspilot-dev
LANGFUSE_SECRET_KEY=sk-lf-...-dev
LANGFUSE_BASE_URL=http://langfuse-web:3000
LANGFUSE_ENVIRONMENT=local
```

Disable instrumentation with either:

```bash
LANGFUSE_ENABLED=false
```

or by leaving both credentials empty:

```bash
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

## Trace shape

OpsPilot creates one Langfuse trace per investigation.

Trace name:

```text
investigation.workflow
```

Trace ID:

```text
<investigationId>
```

Trace metadata includes:

- `investigationId`
- `incidentId`
- `serviceName`
- `provider`
- `model`
- `promptVersion`
- `durationMs`
- `success`
- `investigationStatus`
- `confidenceScore`
- `citedRunbooks`
- `evidenceCount`

## Observations

The workflow records only meaningful investigation observations:

1. Tool spans:
   - `query_logs`
   - `query_metrics`
   - `get_deployments`
   - `search_runbooks`
2. One LLM generation:
   - prompt
   - completion
   - provider/model metadata
   - token usage details
   - temperature
   - structured-output success/failure

Tool observations intentionally avoid storing full tool payloads in Langfuse. Full application-owned tool inputs/outputs remain in OpsPilot persistence where the product APIs can inspect them.

## Stored trace ID

When tracing is enabled, OpsPilot stores the Langfuse trace ID on the `investigations.langfuse_trace_id` column. The existing read APIs include it:

```text
GET /api/investigations/:investigationId
GET /api/investigations/:investigationId/report
```

No Langfuse internals are exposed by OpsPilot.

## Failure behavior

Telemetry is wrapped in a safe observer. Langfuse SDK errors are logged as warnings and never fail the request.

If Langfuse is unavailable:

- investigation continues
- database persistence continues
- API response continues
- warning is logged

## Local smoke check

Start the local stack:

```bash
cp .env.example .env
pnpm docker:up
```

Run a deterministic investigation without waiting on a local LLM:

```bash
OPSPILOT_DEMO_FAKE_LLM=true pnpm demo:investigation
```

Then open Langfuse:

```text
http://localhost:3001
```

Default local login from `.env.example`:

```text
admin@opspilot.local
opspilot-local-admin
```

Expected result: one trace named `investigation.workflow` with four tool spans and one generation observation.

## Troubleshooting

- No traces: verify `LANGFUSE_ENABLED` is not `false` and both credentials are set.
- API works but Langfuse is empty: verify the API container can reach `LANGFUSE_BASE_URL`.
- Startup should not fail when disabled: set `LANGFUSE_ENABLED=false` and restart the API.
- Langfuse unavailable warnings are non-fatal by design.
