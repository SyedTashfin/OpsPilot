import type { FastifyInstance } from "fastify";
import type { IncidentRepository } from "../modules/incidents/incident.repository.js";

export function registerIncidentRoutes(app: FastifyInstance, repository: IncidentRepository): void {
  app.get("/api/incidents", async () => ({ items: await repository.list() }));
  app.get<{ Params: { incidentId: string } }>(
    "/api/incidents/:incidentId",
    async (request, reply) => {
      const incident = await repository.findById(request.params.incidentId);
      if (!incident) return reply.code(404).send({ error: "incident_not_found" });
      return incident;
    },
  );
}
