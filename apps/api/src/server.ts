import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { runMigrations } from "@opspilot/database";
import { createLLMClient, type LLMClient } from "@opspilot/llm";
import {
  SafeInvestigationObserver,
  createInvestigationObserver,
  type InvestigationObserver,
} from "@opspilot/telemetry";
import type { ApiConfig } from "./config.js";
import { createDatabasePool } from "./plugins/db.js";
import { registerDemoRoutes } from "./routes/demo.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerIncidentRoutes } from "./routes/incidents.routes.js";
import { registerInvestigationRoutes } from "./routes/investigations.routes.js";
import { registerLLMRoutes } from "./routes/llm.routes.js";
import { registerLogRoutes } from "./routes/logs.routes.js";
import { registerRunbookRoutes } from "./routes/runbooks.routes.js";
import { registerSecurity } from "./plugins/security.js";
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
  readonly investigationObserver?: InvestigationObserver;
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

  registerSecurity(app, config);

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
  const rawObserver =
    dependencies.investigationObserver ??
    createInvestigationObserver({
      enabled:
        config.langfuseEnabled ?? Boolean(config.langfusePublicKey && config.langfuseSecretKey),
      ...(config.langfusePublicKey ? { publicKey: config.langfusePublicKey } : {}),
      ...(config.langfuseSecretKey ? { secretKey: config.langfuseSecretKey } : {}),
      baseUrl: config.langfuseBaseUrl,
      environment: config.langfuseEnvironment,
    });
  const observer = new SafeInvestigationObserver(rawObserver, (error, action) => {
    app.log.warn(
      { error, action },
      "Langfuse telemetry failed; continuing investigation workflow.",
    );
  });
  const investigationWorkflow = new InvestigationWorkflow(
    investigationRepository,
    rag,
    llm,
    observer,
  );

  registerHealthRoutes(app, pool, config);
  registerServiceRoutes(app, services);
  registerLogRoutes(app, logs);
  registerLLMRoutes(app, llm);
  registerIncidentRoutes(app, incidents);
  registerInvestigationRoutes(app, investigationWorkflow, investigationRepository);
  registerDemoRoutes(app, demo, logs, incidents);
  registerRunbookRoutes(app, rag);

  app.addHook("onClose", async () => {
    await observer.flush();
    if (!dependencies.pool) await pool.end();
  });

  return app;
}
