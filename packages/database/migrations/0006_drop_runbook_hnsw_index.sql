-- V1 uses exact pgvector distance search over a tiny runbook corpus.
-- HNSW returned zero rows on the seeded five-row corpus in local verification,
-- while exact sequential distance search returned correct results.
DROP INDEX IF EXISTS runbook_chunks_embedding_hnsw;
