import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { ApiConfig } from "../config.js";

async function probeHttp(url: string): Promise<"ok" | "error"> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export function registerHealthRoutes(app: FastifyInstance, pool: pg.Pool, config: ApiConfig): void {
  app.get("/api/health", async () => {
    const database = await pool.query("SELECT 1").then(
      () => "ok" as const,
      () => "error" as const,
    );
    return {
      status: database === "ok" ? "ok" : "degraded",
      services: {
        database,
        ollama: await probeHttp(new URL("/api/tags", config.ollamaBaseUrl).toString()),
        langfuse: await probeHttp(config.langfuseBaseUrl),
      },
    };
  });

  app.get("/", () => ({ service: "@opspilot/api", status: "ready" }));
}
