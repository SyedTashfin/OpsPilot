import type { FastifyInstance } from "fastify";
import { logsBatchSchema } from "@opspilot/contracts";
import type { LogRepository } from "../modules/logs/log.repository.js";
import { sendApiError } from "./api-error.js";

export function registerLogRoutes(app: FastifyInstance, repository: LogRepository): void {
  app.get("/api/logs", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const filters = {
      ...(query.service ? { service: query.service } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.limit ? { limit: Number(query.limit) } : {}),
    };
    return {
      items: await repository.list(filters),
    };
  });

  app.post("/api/logs/batch", async (request, reply) => {
    const parsed = logsBatchSchema.safeParse(request.body);
    if (!parsed.success)
      return sendApiError(
        reply,
        400,
        "invalid_logs_batch",
        "Invalid logs batch.",
        parsed.error.flatten(),
      );
    const inserted = await repository.insertBatch(parsed.data.logs);
    return reply.code(202).send({ inserted });
  });
}
