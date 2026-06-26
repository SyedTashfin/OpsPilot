import type { FastifyInstance } from "fastify";
import type { ServiceRepository } from "../modules/services/service.repository.js";

export function registerServiceRoutes(app: FastifyInstance, repository: ServiceRepository): void {
  app.get("/api/services", async () => ({ items: await repository.list() }));
  app.get<{ Params: { serviceId: string } }>("/api/services/:serviceId", async (request, reply) => {
    const service = await repository.findByIdOrName(request.params.serviceId);
    if (!service) return reply.code(404).send({ error: "service_not_found" });
    return service;
  });
}
