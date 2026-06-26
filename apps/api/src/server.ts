import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { runMigrations } from "@opspilot/database";
import type { ApiConfig } from "./config.js";
import { createDatabasePool } from "./plugins/db.js";
import { registerDemoRoutes } from "./routes/demo.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerIncidentRoutes } from "./routes/incidents.routes.js";
import { registerLogRoutes } from "./routes/logs.routes.js";
import { registerServiceRoutes } from "./routes/services.routes.js";
import { DemoRepository } from "./modules/demo/demo.repository.js";
import { IncidentRepository } from "./modules/incidents/incident.repository.js";
import { LogRepository } from "./modules/logs/log.repository.js";
import { ServiceRepository } from "./modules/services/service.repository.js";

export type ServerDependencies = {
  readonly pool?: pg.Pool;
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
  const demo = new DemoRepository(pool);

  registerHealthRoutes(app, pool, config);
  registerServiceRoutes(app, services);
  registerLogRoutes(app, logs);
  registerIncidentRoutes(app, incidents);
  registerDemoRoutes(app, demo, logs, incidents);

  app.addHook("onClose", async () => {
    if (!dependencies.pool) await pool.end();
  });

  return app;
}
