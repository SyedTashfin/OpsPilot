CREATE INDEX IF NOT EXISTS idx_deployments_service_deployed_at
  ON deployments(service_id, deployed_at DESC);

CREATE INDEX IF NOT EXISTS idx_log_entries_service_timestamp
  ON log_entries(service_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_log_entries_level_timestamp
  ON log_entries(level, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_log_entries_trace_id
  ON log_entries(trace_id) WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_log_entries_attributes_gin
  ON log_entries USING GIN (attributes);

CREATE INDEX IF NOT EXISTS idx_metric_points_service_metric_timestamp
  ON metric_points(service_id, metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_service_detected_at
  ON incidents(service_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_status_detected_at
  ON incidents(status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_runbook_chunks_embedding
  ON runbook_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 32)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investigations_incident_created_at
  ON investigations(incident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_calls_investigation_created_at
  ON tool_calls(investigation_id, created_at ASC);
