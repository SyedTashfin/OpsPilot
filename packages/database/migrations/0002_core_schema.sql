CREATE TABLE IF NOT EXISTS beautycorp_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_team TEXT NOT NULL,
  runtime TEXT NOT NULL,
  criticality TEXT NOT NULL CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES beautycorp_services(id),
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  deployed_by TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'rolled_back')),
  deployed_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (service_id, version, environment)
);

CREATE TABLE IF NOT EXISTS log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES beautycorp_services(id),
  deployment_id UUID REFERENCES deployments(id),
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  message TEXT NOT NULL,
  trace_id TEXT,
  span_id TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES beautycorp_services(id),
  timestamp TIMESTAMPTZ NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES beautycorp_services(id),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
  status TEXT NOT NULL CHECK (status IN ('detected', 'investigating', 'analyzed', 'closed')),
  detected_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  detection_reason TEXT NOT NULL,
  suspected_root_cause TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES beautycorp_services(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  source_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runbook_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (runbook_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  langfuse_trace_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  summary TEXT,
  probable_root_cause TEXT,
  confidence_score NUMERIC(4,3) CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('prompt', 'tool_call', 'observation', 'reasoning', 'final')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, step_index)
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  groundedness_score NUMERIC(4,3) NOT NULL CHECK (groundedness_score BETWEEN 0 AND 1),
  completeness_score NUMERIC(4,3) NOT NULL CHECK (completeness_score BETWEEN 0 AND 1),
  root_cause_quality_score NUMERIC(4,3) NOT NULL CHECK (root_cause_quality_score BETWEEN 0 AND 1),
  citation_score NUMERIC(4,3) NOT NULL CHECK (citation_score BETWEEN 0 AND 1),
  overall_score NUMERIC(4,3) NOT NULL CHECK (overall_score BETWEEN 0 AND 1),
  notes TEXT,
  langfuse_score_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
