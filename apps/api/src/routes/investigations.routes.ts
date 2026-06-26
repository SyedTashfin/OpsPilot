import type { FastifyInstance } from "fastify";
import type { InvestigationWorkflow } from "../modules/investigations/index.js";

export function registerInvestigationRoutes(
  app: FastifyInstance,
  workflow: InvestigationWorkflow,
): void {
  app.post<{ Params: { incidentId: string } }>(
    "/api/incidents/:incidentId/investigations",
    async (request, reply) => {
      try {
        return await workflow.investigate(request.params.incidentId);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return reply.code(404).send({ error: "incident_not_found" });
        }
        request.log.error({ error }, "Investigation failed");
        return reply.code(500).send({ error: "investigation_failed" });
      }
    },
  );
}
