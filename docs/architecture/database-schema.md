# OpsPilot V1 Database Schema

OpsPilot V1 uses PostgreSQL with pgvector. The database supports the single approved vertical slice:

1. BeautyCorp synthetic services produce logs and metrics.
2. Incidents are detected from synthetic operational signals.
3. A single investigation agent queries logs, deployments, metrics, and runbooks.
4. Investigation summaries, tool calls, citations, evaluations, and Langfuse trace IDs are persisted for the dashboard.

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
| `evaluations`         | Evaluation scores mirrored from Langfuse for dashboard display.                                     |

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

The recommendation service seed includes the initial latency incident context needed by later V1 issues: deployment `rec-2026.06.1` and a runbook describing feature-store timeout investigation.

## Embedding dimension

`runbook_chunks.embedding` is currently `vector(768)` per the approved V1 design. Before Issue #6 indexes real embeddings, confirm that the configured Ollama embedding model returns 768-dimensional vectors. If the model differs, change the dimension through a migration before storing embeddings.
