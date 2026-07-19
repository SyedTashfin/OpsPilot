-- V1 runbook retrieval uses exact cosine distance search over a small corpus.
-- The IVFFlat ANN index from 0003 is intentionally removed while preserving
-- runbook_chunks, embeddings, documents, and exact-search behavior.
DROP INDEX IF EXISTS idx_runbook_chunks_embedding;
