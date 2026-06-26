import type { FastifyInstance } from "fastify";
import type {
  InvestigationRepository,
  InvestigationWorkflow,
} from "../modules/investigations/index.js";
import { sendApiError } from "./api-error.js";

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
          return sendApiError(reply, 404, "incident_not_found", "Incident not found.");
        }
        request.log.error({ error }, "Investigation failed");
        return sendApiError(reply, 500, "investigation_failed", "Investigation failed.");
      }
    },
  );

  app.get<{ Params: { investigationId: string } }>(
    "/api/investigations/:investigationId",
    async (request, reply) => {
      const investigation = await repository.getInvestigationDetail(request.params.investigationId);
      if (!investigation)
        return sendApiError(reply, 404, "investigation_not_found", "Investigation not found.");
      return investigation;
    },
  );

  app.get<{ Params: { investigationId: string } }>(
    "/api/investigations/:investigationId/report",
    async (request, reply) => {
      const report = await repository.getInvestigationReport(request.params.investigationId);
      if (!report)
        return sendApiError(reply, 404, "investigation_not_found", "Investigation not found.");
      return report;
    },
  );
}
