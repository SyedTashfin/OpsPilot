import type { FastifyInstance } from "fastify";
import type { ServiceRepository } from "../modules/services/service.repository.js";
import { sendApiError } from "./api-error.js";

export function registerServiceRoutes(app: FastifyInstance, repository: ServiceRepository): void {
  app.get("/api/services", async () => ({ items: await repository.list() }));
  app.get<{ Params: { serviceId: string } }>("/api/services/:serviceId", async (request, reply) => {
    const service = await repository.findByIdOrName(request.params.serviceId);
    if (!service) return sendApiError(reply, 404, "service_not_found", "Service not found.");
    return service;
  });
}
