import { describe, expect, it, vi } from "vitest";
import { postTelemetryBatch } from "./beautycorp/api-client.js";
import { generateDeployments } from "./beautycorp/deployment-generator.js";
import { recommendationLatencyScenario } from "./beautycorp/incident-scenarios.js";
import { generateLogBatch } from "./beautycorp/log-generator.js";
import { generateMetricBatch } from "./beautycorp/metrics-generator.js";
import { beautyCorpServices } from "./beautycorp/services.js";
import { buildTelemetrySnapshot, createHeartbeat, getServiceName } from "./main.js";

describe("BeautyCorp demo service", () => {
  it("identifies itself", () => {
    expect(getServiceName()).toBe("@opspilot/demo-service");
  });

  it("defines the five V1 BeautyCorp services", () => {
    expect(beautyCorpServices.map((service) => service.name)).toEqual([
      "recommendation-service",
      "customer-chat-service",
      "inventory-service",
      "payment-service",
      "image-analysis-service",
    ]);
  });

  it("generates the recommendation latency incident signals", () => {
    const logs = generateLogBatch();
    const metrics = generateMetricBatch();
    const deployments = generateDeployments();

    expect(deployments).toContainEqual(
      expect.objectContaining({ serviceName: "recommendation-service", version: "rec-2026.06.1" }),
    );
    const timeoutLog = logs.find(
      (log) =>
        log.serviceName === "recommendation-service" &&
        log.level === "error" &&
        log.message.includes("Feature store timeout"),
    );
    const recommendationLatencyValues = metrics
      .filter(
        (metric) =>
          metric.serviceName === "recommendation-service" && metric.metricName === "p95_latency_ms",
      )
      .map((metric) => metric.metricValue);

    expect(timeoutLog).toBeDefined();
    expect(Math.max(...recommendationLatencyValues)).toBeGreaterThan(1200);
  });

  it("builds a full telemetry snapshot", () => {
    const snapshot = buildTelemetrySnapshot();
    const heartbeat = createHeartbeat();

    expect(snapshot.services).toHaveLength(5);
    expect(snapshot.incidents).toEqual([recommendationLatencyScenario]);
    expect(snapshot.logs.length).toBeGreaterThan(30);
    expect(snapshot.metrics.length).toBeGreaterThan(40);
    expect(heartbeat.status).toBe("ready");
  });

  it("posts telemetry batches to the expected API endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));

    await postTelemetryBatch(buildTelemetrySnapshot(), {
      apiBaseUrl: "http://opspilot-api:4000",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toEqual(new URL("http://opspilot-api:4000/api/demo/telemetry/batch"));
    expect(firstCall?.[1]).toEqual(
      expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" } }),
    );
  });
});
