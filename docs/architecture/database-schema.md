# OpsPilot V1 Database Schema

OpsPilot V1 uses PostgreSQL with pgvector. The database supports the single approved vertical slice:

1. BeautyCorp synthetic services produce logs and metrics.
2. Incidents are detected from synthetic operational signals.
3. A single investigation agent queries logs, deployments, metrics, and runbooks.
4. Investigation summaries, tool calls, citations, and optional Langfuse trace IDs are persisted for the dashboard.

## Extensions

- `pgcrypto`: UUID generation through `gen_random_uuid()`.
- `vector`: pgvector embeddings for runbook retrieval.

## Tables

| Table                 | Purpose                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `schema_migrations`   | Immutable migration ledger with checksums.                                                          |
| `beautycorp_services` | Fictional BeautyCorp services such as recommendation, payment, inventory, chat, and image analysis. |
| `deployments`         | Synthetic production deployment events.                                                             |
| `log_entries`         | Structured synthetic service logs.                                                                  |
| `metric_points`       | Lightweight metrics for the V1 detector and investigation tools.                                    |
| `incidents`           | Deterministically detected incidents.                                                               |
| `runbooks`            | Human-authored operational guidance.                                                                |
| `runbook_chunks`      | Chunked runbooks with pgvector embeddings.                                                          |
| `investigations`      | One investigation run per incident.                                                                 |
| `investigation_steps` | Product-facing agent timeline.                                                                      |
| `tool_calls`          | Application-level tool call records.                                                                |
| `evaluations`         | Reserved schema surface for future evaluation records; no V1 evaluation feature is implemented.     |

## Migration commands

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

`db:reset` is local-development only and refuses to run when `NODE_ENV=production`.

## Seed data

The seed migration inserts five BeautyCorp services and service runbooks:

- `recommendation-service`
- `customer-chat-service`
- `inventory-service`
- `payment-service`
- `image-analysis-service`

The recommendation service seed includes the initial latency incident context: deployment `rec-2026.06.1` and a runbook describing feature-store timeout investigation.

## Embedding dimension

`runbook_chunks.embedding` is `vector(768)`. The ingestion path validates embedding dimensions before insert and fails if the configured embedding model returns a different dimension.

## Investigation history API

`GET /api/investigations` returns a bounded public read-only history page from persisted `investigations` rows only. Items include IDs, status, timestamps, safe persisted summary/root-cause fields, confidence, and a stable dashboard deep link. The endpoint does not return prompts, tool-call payloads, hidden evaluation ground truth, raw model responses, credentials, or trace payload internals.

History is ordered by `created_at DESC, id DESC` and uses an opaque cursor containing that tie-breaker. Page size defaults to 10 and is capped at 50; malformed cursors are rejected with the standard API error envelope.

## pgvector exact-search indexes

V1 retrieval uses exact cosine distance over the small runbook corpus. Historical migrations remain immutable, but forward migrations remove the unused HNSW and IVFFlat ANN indexes while preserving `runbook_chunks.embedding`, documents, and retrieval behavior. The migration runner is forward-only; rollback requires a new migration that recreates an ANN index after validating it is needed.
