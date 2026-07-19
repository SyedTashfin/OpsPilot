-- Sanitize synthetic answer leakage while preserving historical migrations.
UPDATE incidents
SET suspected_root_cause = NULL,
    updated_at = now()
WHERE metadata->>'scenarioId' = 'beautycorp-rec-latency-2026-06-26'
  AND metadata->>'synthetic' = 'true'
  AND suspected_root_cause IS NOT NULL;

UPDATE runbooks
SET body = 'Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. First checks: compare latency with latest deployment, inspect feature_store_timeout_ms attributes, check cache hit ratio, and review downstream feature store health. Diagnostic path: compare the incident timeline to recent deployments, inspect timeout and retry configuration diffs, and validate whether retries increased after feature-store timeouts. Safe response for V1 demo: continue diagnostics and prepare rollback/configuration options only after confirming causality from logs and metrics.',
    updated_at = now()
WHERE slug = 'recommendation-service-latency'
  AND body LIKE '%Common root cause:%';
