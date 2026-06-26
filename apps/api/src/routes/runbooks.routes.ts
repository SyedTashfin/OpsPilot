import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RunbookRagService } from "@opspilot/rag";
import { sendApiError } from "./api-error.js";

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export function registerRunbookRoutes(app: FastifyInstance, rag: RunbookRagService): void {
  app.get("/api/runbooks/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(
        reply,
        400,
        "invalid_runbook_search_query",
        "Invalid runbook search query.",
        parsed.error.flatten(),
      );
    }

    const results = await rag.search(parsed.data.q, parsed.data.limit);
    return { items: results };
  });
}
