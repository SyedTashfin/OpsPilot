import type { FastifyInstance } from "fastify";
import type { IncidentRepository } from "../modules/incidents/incident.repository.js";
import { sendApiError } from "./api-error.js";

export function registerIncidentRoutes(app: FastifyInstance, repository: IncidentRepository): void {
  app.get("/api/incidents", async () => ({ items: await repository.list() }));
  app.get<{ Params: { incidentId: string } }>(
    "/api/incidents/:incidentId",
    async (request, reply) => {
      const incident = await repository.findById(request.params.incidentId);
      if (!incident) return sendApiError(reply, 404, "incident_not_found", "Incident not found.");
      return incident;
    },
  );
}
