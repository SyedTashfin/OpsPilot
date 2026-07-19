# Runbook RAG

OpsPilot v1.0.0 includes runbook ingestion and pgvector retrieval for the V1 investigation workflow.

## Source data

Runbooks live in PostgreSQL in the `runbooks` table. Seed data is inserted by the database migrations and covers the five BeautyCorp services.

## Ingestion

Runbook ingestion is repeatable:

```bash
pnpm rag:ingest
```

By default, ingestion uses Ollama:

```text
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

For deterministic local smoke tests that should not depend on a pulled Ollama model, use:

```bash
RAG_EMBEDDING_PROVIDER=deterministic pnpm rag:ingest
```

The deterministic provider is for tests and local verification only; production/default behavior is Ollama.

## Retrieval

Search uses exact pgvector cosine distance over the V1 runbook corpus. The corpus is intentionally tiny for the portfolio MVP, so OpsPilot does not create an approximate nearest-neighbor vector index yet. Local verification showed indexed plans can return zero rows on the five-row seed set; exact search in a short transaction is simpler and correct for V1.

Search from the CLI:

```bash
pnpm rag:search "feature store timeout recommendation latency"
```

Or through the API:

```text
GET /api/runbooks/search?q=feature%20store%20timeout&limit=5
```

## Embedding dimension

`runbook_chunks.embedding` is `vector(768)`. The ingestion path validates every embedding dimension before insert and fails loudly if the configured embedding model returns a different dimension.

## V1 index reconciliation

Migrations `0006_drop_runbook_hnsw_index.sql` and `0008_drop_runbook_ivfflat_index.sql` reconcile the schema to the V1 exact-search implementation. Runtime retrieval disables index and bitmap scans inside the search transaction and orders directly by `c.embedding <=> $1::vector`; no application query references the removed ANN indexes. The vector column, chunks, documents, and embeddings remain intact.

Rollback, if a future larger corpus needs ANN search again, is manual and forward-only in normal operations: add a new migration that recreates the selected pgvector index, for example `CREATE INDEX CONCURRENTLY ... USING ivfflat ...` or HNSW after validating recall on the target corpus. The application migration runner records forward migrations and does not auto-roll back applied SQL.
