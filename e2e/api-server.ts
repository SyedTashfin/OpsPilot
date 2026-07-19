import { loadConfig } from "../apps/api/src/config.js";
import { buildServer } from "../apps/api/src/server.js";
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

const config = loadConfig({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? process.env.E2E_API_PORT ?? "4300",
  API_AUTO_MIGRATE: process.env.API_AUTO_MIGRATE ?? "false",
  LANGFUSE_ENABLED: "false",
});
const app = await buildServer(config, { llm: new DeterministicE2ELLM() });
const shutdown = async () => {
  await app.close();
};
process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
await app.listen({ port: config.port, host: "127.0.0.1" });
