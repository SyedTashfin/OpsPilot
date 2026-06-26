CREATE INDEX IF NOT EXISTS runbook_chunks_embedding_hnsw
  ON runbook_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS runbook_chunks_runbook_id_idx
  ON runbook_chunks(runbook_id);
