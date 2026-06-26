import { recommendationLatencyScenario } from "./incident-scenarios.js";
import { choose, createSeededRandom, jitter } from "./random.js";
import { beautyCorpServices } from "./services.js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type SyntheticLogEntry = {
  readonly serviceName: string;
  readonly deploymentVersion?: string;
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes: Record<string, string | number | boolean>;
};

export type GenerateLogBatchOptions = {
  readonly seed?: number;
  readonly baseTime?: Date;
  readonly normalLogsPerService?: number;
};

const normalMessages: Record<string, readonly string[]> = {
  "recommendation-service": [
    "Generated personalized product recommendations",
    "Loaded customer segment features from cache",
    "Recommendation request completed",
  ],
  "customer-chat-service": [
    "Conversation turn completed",
    "Retrieved support policy snippets",
    "Generated customer response draft",
  ],
  "inventory-service": [
    "Warehouse stock sync completed",
    "Inventory reservation checked",
    "Availability query completed",
  ],
  "payment-service": [
    "Payment authorization completed",
    "Idempotency key verified",
    "Checkout payment session created",
  ],
  "image-analysis-service": [
    "Image preprocessing completed",
    "Skin-care model inference completed",
    "Product match candidates ranked",
  ],
};

function timestamp(baseTime: Date, offsetSeconds: number): string {
  return new Date(baseTime.getTime() + offsetSeconds * 1000).toISOString();
}

function traceId(serviceName: string, index: number): string {
  return `${serviceName.replaceAll("-", "")}-${index.toString().padStart(4, "0")}`;
}

export function generateLogBatch(options: GenerateLogBatchOptions = {}): SyntheticLogEntry[] {
  const random = createSeededRandom(options.seed ?? 42);
  const baseTime = options.baseTime ?? new Date("2026-06-26T09:45:00.000Z");
  const normalLogsPerService = options.normalLogsPerService ?? 6;
  const logs: SyntheticLogEntry[] = [];

  for (const service of beautyCorpServices) {
    const messages = normalMessages[service.name] ?? ["Request completed"];
    for (let index = 0; index < normalLogsPerService; index += 1) {
      const latencyMs = jitter(service.name === "recommendation-service" ? 180 : 120, 80, random);
      const deploymentVersion =
        service.name === "recommendation-service" ? "rec-2026.06.1" : undefined;
      logs.push({
        serviceName: service.name,
        ...(deploymentVersion ? { deploymentVersion } : {}),
        timestamp: timestamp(baseTime, index * 45 + beautyCorpServices.indexOf(service) * 7),
        level: latencyMs > 230 ? "warn" : "info",
        message: choose(messages, random),
        traceId: traceId(service.name, index),
        spanId: `span-${index.toString().padStart(4, "0")}`,
        attributes: {
          endpoint:
            service.name === "recommendation-service" ? "/v1/recommendations" : "/health/workload",
          latencyMs,
          environment: "production",
          synthetic: true,
        },
      });
    }
  }

  return [...logs, ...generateRecommendationIncidentLogs(baseTime)];
}

export function generateRecommendationIncidentLogs(
  baseTime = new Date("2026-06-26T09:45:00.000Z"),
): SyntheticLogEntry[] {
  const incidentOffsets = [210, 360, 510, 660, 780, 870];

  return incidentOffsets.map((offset, index) => ({
    serviceName: recommendationLatencyScenario.serviceName,
    deploymentVersion: "rec-2026.06.1",
    timestamp: timestamp(baseTime, offset),
    level: index < 2 ? "warn" : "error",
    message:
      index < 2
        ? "Feature store latency above warning threshold"
        : "Feature store timeout after 2000ms while building recommendation candidates",
    traceId: traceId("recommendation-service-incident", index),
    spanId: `incident-span-${index.toString().padStart(4, "0")}`,
    attributes: {
      endpoint: "/v1/recommendations",
      customerSegment: index % 2 === 0 ? "premium" : "loyalty",
      latencyMs: 1840 + index * 155,
      featureStoreTimeoutMs: 2000,
      retryCount: 2 + index,
      deploymentVersion: "rec-2026.06.1",
      incidentScenarioId: recommendationLatencyScenario.id,
      synthetic: true,
    },
  }));
}
