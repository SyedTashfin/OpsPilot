import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import {
  deriveHealthDiagnosticCategory,
  deriveOverallHealth,
  healthResponseSchema,
  type HealthDependency,
} from "@opspilot/contracts";
import type { ApiConfig } from "../config.js";

async function probeHttp(url: string): Promise<HealthDependency> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const latencyMs = Date.now() - startedAt;
    return {
      state: response.ok ? "healthy" : "degraded",
      diagnosticCategory: response.ok ? "ok" : "dependency_degraded",
      latencyMs,
      ...(response.ok ? { lastSuccessAt: new Date().toISOString() } : {}),
    };
  } catch {
    return {
      state: "unknown",
      diagnosticCategory: "probe_failed",
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function probeDatabase(pool: pg.Pool): Promise<HealthDependency> {
  const startedAt = Date.now();
  try {
    await pool.query("SELECT 1");
    return {
      state: "healthy",
      diagnosticCategory: "ok",
      latencyMs: Date.now() - startedAt,
      lastSuccessAt: new Date().toISOString(),
    };
  } catch {
    return {
      state: "unhealthy",
      diagnosticCategory: "dependency_unavailable",
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function safeVersion(): Promise<string | undefined> {
  try {
    const pkg = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      version?: string;
    };
    return pkg.version;
  } catch {
    return undefined;
  }
}

export function registerHealthRoutes(app: FastifyInstance, pool: pg.Pool, config: ApiConfig): void {
  app.get("/api/health", async () => {
    const dependencies: Record<string, HealthDependency> = {
      database: await probeDatabase(pool),
      ollama: await probeHttp(new URL("/api/tags", config.ollamaBaseUrl).toString()),
      langfuse:
        config.langfuseEnabled === false
          ? { state: "unknown", diagnosticCategory: "not_configured" }
          : await probeHttp(config.langfuseBaseUrl),
    };
    const status = deriveOverallHealth(dependencies);
    return healthResponseSchema.parse({
      status,
      timestamp: new Date().toISOString(),
      version: await safeVersion(),
      dependencies,
      diagnosticCategory: deriveHealthDiagnosticCategory(status, dependencies),
    });
  });

  app.get("/", () => ({ service: "@opspilot/api", status: "ready" }));
}
