INSERT INTO beautycorp_services (name, display_name, description, owner_team, runtime, criticality)
VALUES
  ('recommendation-service', 'Recommendation Service', 'Personalized product recommendation API for BeautyCorp storefronts.', 'personalization-platform', 'nodejs', 'critical'),
  ('customer-chat-service', 'Customer Chat Service', 'Customer support assistant backend for product and order questions.', 'customer-experience-ai', 'python', 'high'),
  ('inventory-service', 'Inventory Service', 'Inventory availability and warehouse synchronization API.', 'supply-chain-platform', 'java', 'high'),
  ('payment-service', 'Payment Service', 'Payment authorization and checkout orchestration service.', 'commerce-platform', 'go', 'critical'),
  ('image-analysis-service', 'Image Analysis Service', 'Skin-care image analysis and product matching service.', 'beauty-ai-platform', 'python', 'high')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  owner_team = EXCLUDED.owner_team,
  runtime = EXCLUDED.runtime,
  criticality = EXCLUDED.criticality;

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'recommendation-service'
)
INSERT INTO deployments (service_id, version, commit_sha, deployed_by, environment, status, deployed_at, metadata)
SELECT id, 'rec-2026.06.1', '8f4c2a91', 'beautycorp-deploy-bot', 'production', 'succeeded', '2026-06-26T09:42:00Z',
  '{"change":"feature-store timeout tuning","risk":"medium"}'::jsonb
FROM service
ON CONFLICT (service_id, version, environment) DO UPDATE SET
  commit_sha = EXCLUDED.commit_sha,
  deployed_by = EXCLUDED.deployed_by,
  status = EXCLUDED.status,
  deployed_at = EXCLUDED.deployed_at,
  metadata = EXCLUDED.metadata;

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'recommendation-service'
)
INSERT INTO runbooks (service_id, title, slug, body, source_path, version)
SELECT id,
  'Recommendation Service Latency Runbook',
  'recommendation-service-latency',
  'Symptoms: p95 latency above 1200ms, feature-store timeout errors, elevated retry count. First checks: compare latency with latest deployment, inspect feature_store_timeout_ms attributes, check cache hit ratio, and review downstream feature store health. Diagnostic path: compare the incident timeline to recent deployments, inspect timeout and retry configuration diffs, and validate whether retries increased after feature-store timeouts. Safe response for V1 demo: continue diagnostics and prepare rollback/configuration options only after confirming causality from logs and metrics.',
  'docs/runbooks/recommendation-service-latency.md',
  1
FROM service
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  source_path = EXCLUDED.source_path,
  version = EXCLUDED.version,
  updated_at = now();

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'customer-chat-service'
)
INSERT INTO runbooks (service_id, title, slug, body, source_path, version)
SELECT id,
  'Customer Chat Service Error Runbook',
  'customer-chat-service-errors',
  'Investigate elevated customer-chat-service errors by checking prompt gateway status, retrieval latency, safety filter responses, and conversation store availability. Confirm that synthetic test traffic is not being mistaken for production traffic.',
  'docs/runbooks/customer-chat-service-errors.md',
  1
FROM service
ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, updated_at = now();

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'inventory-service'
)
INSERT INTO runbooks (service_id, title, slug, body, source_path, version)
SELECT id,
  'Inventory Service Database Timeout Runbook',
  'inventory-service-db-timeouts',
  'Check warehouse synchronization lag, database connection pool saturation, slow product availability queries, and recent schema changes when inventory-service emits timeout warnings.',
  'docs/runbooks/inventory-service-db-timeouts.md',
  1
FROM service
ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, updated_at = now();

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'payment-service'
)
INSERT INTO runbooks (service_id, title, slug, body, source_path, version)
SELECT id,
  'Payment Service Rate Limit Runbook',
  'payment-service-rate-limits',
  'For payment-service rate limit incidents, inspect gateway response codes, processor throttling, retry budgets, idempotency keys, and checkout error budget impact before recommending any operational action.',
  'docs/runbooks/payment-service-rate-limits.md',
  1
FROM service
ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, updated_at = now();

WITH service AS (
  SELECT id FROM beautycorp_services WHERE name = 'image-analysis-service'
)
INSERT INTO runbooks (service_id, title, slug, body, source_path, version)
SELECT id,
  'Image Analysis Service Model Error Runbook',
  'image-analysis-service-model-errors',
  'Investigate model errors by checking model version, image preprocessing failures, GPU or CPU fallback mode, moderation responses, and request payload size distributions.',
  'docs/runbooks/image-analysis-service-model-errors.md',
  1
FROM service
ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, updated_at = now();
