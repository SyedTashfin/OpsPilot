import type { FastifyInstance } from "fastify";
import type {
  InvestigationRepository,
  InvestigationWorkflow,
} from "../modules/investigations/index.js";

export function registerInvestigationRoutes(
  app: FastifyInstance,
  workflow: InvestigationWorkflow,
  repository: InvestigationRepository,
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

  app.get<{ Params: { investigationId: string } }>(
    "/api/investigations/:investigationId",
    async (request, reply) => {
      const investigation = await repository.getInvestigationDetail(request.params.investigationId);
      if (!investigation) return reply.code(404).send({ error: "investigation_not_found" });
      return investigation;
    },
  );

  app.get<{ Params: { investigationId: string } }>(
    "/api/investigations/:investigationId/report",
    async (request, reply) => {
      const report = await repository.getInvestigationReport(request.params.investigationId);
      if (!report) return reply.code(404).send({ error: "investigation_not_found" });
      return report;
    },
  );
}
