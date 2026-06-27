# OpsPilot Architecture

This document is the diagram-first architecture index for OpsPilot v1.0.0. It reflects the implementation in `main` at RC1.

## Overall system

```mermaid
flowchart TB
  subgraph Browser[Reviewer machine]
    UI[OpsPilot Dashboard\napps/web]
  end

  subgraph Compose[Docker Compose local stack]
    API[Fastify API\napps/api]
    Demo[BeautyCorp Demo Service\napps/demo-service]
    PG[(PostgreSQL + pgvector)]
    Ollama[Ollama\nlocal LLM + embeddings]
    Langfuse[Langfuse Web/Worker]
    LFDB[(Langfuse Postgres)]
    ClickHouse[(ClickHouse)]
    Redis[(Redis)]
    Minio[(MinIO)]
  end

  UI -->|REST| API
  Demo -->|synthetic telemetry| API
  API --> PG
  API -->|chat / embeddings| Ollama
  API -. optional traces .-> Langfuse
  Langfuse --> LFDB
  Langfuse --> ClickHouse
  Langfuse --> Redis
  Langfuse --> Minio
```

## Investigation workflow

```mermaid
flowchart TD
  Start[POST /api/incidents/:incidentId/investigations] --> Load[Load incident]
  Load --> Logs[query_logs]
  Logs --> Metrics[query_metrics]
  Metrics --> Deployments[get_deployments]
  Deployments --> Runbooks[search_runbooks]
  Runbooks --> Context[Build structured investigation context]
  Context --> Generate[One LLM generation]
  Generate --> Validate[Validate JSON report]
  Validate --> Persist[Persist investigation steps, evidence, report]
  Persist --> Read[GET /api/investigations/:id/report]

  Logs -. observation .-> Trace[Langfuse trace optional]
  Metrics -. observation .-> Trace
  Deployments -. observation .-> Trace
  Runbooks -. observation .-> Trace
  Generate -. generation .-> Trace
  Persist -. completion metadata .-> Trace
```

The workflow is deterministic up to the LLM call. OpsPilot does not run a planner loop, autonomous retries, remediation, or tool selection in V1.

## RAG flow

```mermaid
flowchart LR
  RunbookFiles[Runbook markdown/content] --> Ingest[pnpm rag:ingest]
  Ingest --> Chunk[Chunk runbooks]
  Chunk --> Embed[Embedding client]
  Embed --> Store[(runbook_chunks\npgvector)]

  Incident[Incident context] --> Query[RunbookRagService.search]
  Query --> QueryEmbed[Embed search query]
  QueryEmbed --> VectorSearch[Cosine similarity search]
  Store --> VectorSearch
  VectorSearch --> PromptContext[Top runbook citations]
  PromptContext --> LLM[Investigation LLM prompt]
```

Default embeddings use Ollama. Deterministic embeddings exist for local smoke tests.

## LLM provider abstraction

```mermaid
classDiagram
  class LLMClient {
    <<interface>>
    +provider
    +model
    +chat(request) Promise~LLMChatResponse~
    +health() Promise~LLMProviderHealth~
  }

  class OllamaClient
  class GeminiClient
  class TimeoutWrapper
  class DeterministicDemoLLM

  LLMClient <|.. OllamaClient
  LLMClient <|.. GeminiClient
  LLMClient <|.. TimeoutWrapper
  LLMClient <|.. DeterministicDemoLLM
```

Provider-specific behavior stays inside `packages/llm`. The API depends on the `LLMClient` boundary, not on a concrete provider.

## Langfuse integration

```mermaid
flowchart TD
  Workflow[Investigation workflow] --> Observer[InvestigationObserver interface]
  Observer --> Safe[SafeInvestigationObserver]
  Safe --> Enabled{Langfuse enabled + credentials?}
  Enabled -- no --> Noop[NoopInvestigationObserver]
  Enabled -- yes --> LangfuseObserver[LangfuseInvestigationObserver]
  LangfuseObserver --> Trace[investigation.workflow trace]
  Trace --> ToolObs[4 tool observations]
  Trace --> Generation[1 LLM generation]
  Trace --> Metadata[completion metadata]
```

Langfuse is additive. If it is disabled or unavailable, the investigation still completes and persists through OpsPilot's own read model.

## Deployment architecture

```mermaid
flowchart TB
  Dev[Developer / reviewer] --> Compose[Docker Compose]
  Compose --> Web[opspilot-web\nport 3000]
  Compose --> API[opspilot-api\nport 4000]
  Compose --> Demo[opspilot-demo-service]
  Compose --> DB[opspilot-postgres\nport 5432]
  Compose --> Ollama[ollama\nport 11434 or override]
  Compose --> Langfuse[langfuse-web\nport 3001]

  Web --> API
  API --> DB
  API --> Ollama
  API -. optional .-> Langfuse
```

V1 is Docker Compose only. Kubernetes, Terraform, ArgoCD, and cloud hosting are intentionally future scope.

## Package structure

```mermaid
flowchart LR
  Root[opspilot workspace] --> Apps[apps]
  Root --> Packages[packages]
  Root --> Scripts[scripts]
  Root --> Infra[infra]
  Root --> Docs[docs]

  Apps --> API[api]
  Apps --> Web[web]
  Apps --> DemoSvc[demo-service]

  Packages --> Contracts[contracts]
  Packages --> Database[database]
  Packages --> Domain[domain]
  Packages --> LLM[llm]
  Packages --> RAG[rag]
  Packages --> Telemetry[telemetry]

  Scripts --> DBscripts[db]
  Scripts --> RAGscripts[rag]
  Scripts --> DemoScripts[demo]
  Infra --> Compose[compose]
  Infra --> Docker[docker]
```

## Source-of-truth docs

- [`database-schema.md`](database-schema.md)
- [`runbook-rag.md`](runbook-rag.md)
- [`llm-provider-abstraction.md`](llm-provider-abstraction.md)
- [`langfuse-observability.md`](langfuse-observability.md)
- [`../adr/0001-monorepo.md`](../adr/0001-monorepo.md)
- [`../adr/0002-langfuse-observability.md`](../adr/0002-langfuse-observability.md)
