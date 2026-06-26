import type { FastifyInstance } from "fastify";
import { telemetryBatchSchema } from "@opspilot/contracts";
import type { DemoRepository } from "../modules/demo/demo.repository.js";
import type { IncidentRepository } from "../modules/incidents/incident.repository.js";
import type { LogRepository } from "../modules/logs/log.repository.js";

export function registerDemoRoutes(
  app: FastifyInstance,
  demoRepository: DemoRepository,
  logRepository: LogRepository,
  incidentRepository: IncidentRepository,
): void {
  app.post("/api/demo/seed", async () => {
    await demoRepository.seedBase();
    return { seeded: true };
  });

  app.post("/api/demo/telemetry/batch", async (request, reply) => {
    const parsed = telemetryBatchSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: "invalid_telemetry_batch", details: parsed.error.flatten() });

    await demoRepository.upsertServices(parsed.data.services);
    await demoRepository.upsertDeployments(parsed.data.deployments);
    const insertedLogs = await logRepository.insertBatch(parsed.data.logs);
    const insertedMetrics = await demoRepository.insertMetrics(parsed.data.metrics);
    const incidents = await demoRepository.upsertIncidents(parsed.data.incidents);

    return reply.code(202).send({ insertedLogs, insertedMetrics, incidents });
  });

  app.post("/api/demo/detect-incident", async () => incidentRepository.detectLatest());
}
