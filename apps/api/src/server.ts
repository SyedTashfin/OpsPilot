import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { runMigrations } from "@opspilot/database";
import { createLLMClient, type LLMClient } from "@opspilot/llm";
import type { ApiConfig } from "./config.js";
import { createDatabasePool } from "./plugins/db.js";
import { registerDemoRoutes } from "./routes/demo.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerIncidentRoutes } from "./routes/incidents.routes.js";
import { registerInvestigationRoutes } from "./routes/investigations.routes.js";
import { registerLLMRoutes } from "./routes/llm.routes.js";
import { registerLogRoutes } from "./routes/logs.routes.js";
import { registerRunbookRoutes } from "./routes/runbooks.routes.js";
import { registerServiceRoutes } from "./routes/services.routes.js";
import { DemoRepository } from "./modules/demo/demo.repository.js";
import { IncidentRepository } from "./modules/incidents/incident.repository.js";
import { InvestigationRepository, InvestigationWorkflow } from "./modules/investigations/index.js";
import { LogRepository } from "./modules/logs/log.repository.js";
import { ServiceRepository } from "./modules/services/service.repository.js";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";

export type ServerDependencies = {
  readonly pool?: pg.Pool;
  readonly llm?: LLMClient;
};

export async function buildServer(
  config: ApiConfig,
  dependencies: ServerDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const pool = dependencies.pool ?? createDatabasePool(config);

  if (config.autoMigrate) {
    await runMigrations(pool);
  }

  await app.register(cors, { origin: true });

  const services = new ServiceRepository(pool);
  const logs = new LogRepository(pool);
  const incidents = new IncidentRepository(pool);
  const investigationRepository = new InvestigationRepository(pool);
  const demo = new DemoRepository(pool);
  const rag = new RunbookRagService(pool, createEmbeddingClient(loadRagConfig()));
  const llm =
    dependencies.llm ??
    createLLMClient({
      provider: config.llmProvider,
      ollamaBaseUrl: config.ollamaBaseUrl,
      ollamaModel: config.ollamaModel,
      credential: config.llmCredential,
      geminiModel: config.geminiModel,
      timeoutMs: config.llmTimeoutMs,
    });
  const investigationWorkflow = new InvestigationWorkflow(investigationRepository, rag, llm);

  registerHealthRoutes(app, pool, config);
  registerServiceRoutes(app, services);
  registerLogRoutes(app, logs);
  registerLLMRoutes(app, llm);
  registerIncidentRoutes(app, incidents);
  registerInvestigationRoutes(app, investigationWorkflow, investigationRepository);
  registerDemoRoutes(app, demo, logs, incidents);
  registerRunbookRoutes(app, rag);

  app.addHook("onClose", async () => {
    if (!dependencies.pool) await pool.end();
  });

  return app;
}
