import type { FastifyInstance } from "fastify";
import type { LLMClient } from "@opspilot/llm";

export function registerLLMRoutes(app: FastifyInstance, llm: LLMClient): void {
  app.get("/api/llm/status", async () => ({
    provider: llm.provider,
    model: llm.model,
    health: await llm.health(),
  }));
}
