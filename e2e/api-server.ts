import { loadConfig, type ApiConfig } from "../apps/api/src/config.js";
import { buildServer } from "../apps/api/src/server.js";
import type { FastifyInstance } from "fastify";
import type { LLMChatResponse, LLMClient, LLMProviderHealth } from "@opspilot/llm";

class DeterministicE2ELLM implements LLMClient {
  readonly provider = "ollama" as const;
  readonly model = "deterministic-e2e";

  chat(): Promise<LLMChatResponse> {
    return Promise.resolve({
      provider: this.provider,
      model: this.model,
      content: JSON.stringify({
        summary:
          "Recommendation-service latency increased with feature-store timeouts and elevated retries after the deployment window.",
        probableRootCause:
          "Feature-store timeout and retry amplification are the most supported E2E fixture conclusion.",
        confidence: 0.86,
        evidence: [
          {
            source: "metric",
            reference: "p95_latency_ms",
            detail: "Latency exceeded the incident threshold.",
          },
          {
            source: "log",
            reference: "feature_store_timeout",
            detail: "Logs include feature-store timeout and retry evidence.",
          },
        ],
        citedRunbooks: [
          {
            title: "Recommendation Service Latency Runbook",
            slug: "recommendation-service-latency",
            chunkId: "e2e",
            quote: "feature-store timeout errors",
          },
        ],
        recommendedNextDiagnostics: [
          "Compare timeout and retry configuration against the deployment.",
        ],
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimated: true },
    });
  }

  health(): Promise<LLMProviderHealth> {
    return Promise.resolve({
      provider: this.provider,
      configured: true,
      available: true,
      model: this.model,
    });
  }
}

export function loadE2EApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return loadConfig({
    ...env,
    NODE_ENV: env.NODE_ENV ?? "development",
    PORT: env.PORT ?? env.E2E_API_PORT ?? "4300",
    API_AUTO_MIGRATE: env.API_AUTO_MIGRATE ?? "false",
    LANGFUSE_ENABLED: "false",
  });
}

export async function createE2EApiServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ readonly app: FastifyInstance; readonly config: ApiConfig }> {
  const config = loadE2EApiConfig(env);
  const app = await buildServer(config, { llm: new DeterministicE2ELLM() });
  return { app, config };
}

function isDirectLauncherInvocation(argv: readonly string[]): boolean {
  const entrypoint = argv[1]?.replace(/\\/gu, "/") ?? "";
  return entrypoint.endsWith("/e2e/api-server.ts") || entrypoint.endsWith("/e2e/api-server.js");
}

export async function main(): Promise<void> {
  let app: FastifyInstance | undefined;
  try {
    const server = await createE2EApiServer();
    app = server.app;
    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      await app?.close();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
    await app.listen({ port: server.config.port, host: "127.0.0.1" });
  } catch {
    console.error("E2E API server failed to start.");
    await app?.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

if (isDirectLauncherInvocation(process.argv)) {
  void main();
}
