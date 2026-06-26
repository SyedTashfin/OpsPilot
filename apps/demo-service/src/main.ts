import { postTelemetryBatch, type BeautyCorpTelemetryBatch } from "./beautycorp/api-client.js";
import { generateDeployments } from "./beautycorp/deployment-generator.js";
import { incidentScenarios } from "./beautycorp/incident-scenarios.js";
import { generateLogBatch } from "./beautycorp/log-generator.js";
import { generateMetricBatch } from "./beautycorp/metrics-generator.js";
import { beautyCorpServices } from "./beautycorp/services.js";

export function getServiceName(): string {
  return "@opspilot/demo-service";
}

export function buildTelemetrySnapshot(
  baseTime = new Date("2026-06-26T09:45:00.000Z"),
): BeautyCorpTelemetryBatch {
  return {
    generatedAt: baseTime.toISOString(),
    services: beautyCorpServices,
    deployments: generateDeployments(),
    logs: generateLogBatch({ baseTime }),
    metrics: generateMetricBatch(baseTime),
    incidents: incidentScenarios,
  };
}

export function createHeartbeat(): Record<string, string | number> {
  const snapshot = buildTelemetrySnapshot();
  return {
    service: getServiceName(),
    status: "ready",
    syntheticCompany: "BeautyCorp",
    services: snapshot.services.length,
    deployments: snapshot.deployments.length,
    logs: snapshot.logs.length,
    metrics: snapshot.metrics.length,
    incidents: snapshot.incidents.length,
  };
}

async function maybePostSnapshot(): Promise<void> {
  if (process.env.DEMO_SERVICE_POST_ON_START !== "true") {
    return;
  }

  const apiBaseUrl = process.env.OPSPILOT_API_URL ?? "http://opspilot-api:4000";
  await postTelemetryBatch(buildTelemetrySnapshot(new Date()), { apiBaseUrl });
}

if (process.env.NODE_ENV !== "test") {
  console.log(JSON.stringify(createHeartbeat()));

  maybePostSnapshot().catch((error: unknown) => {
    console.error(
      JSON.stringify({ service: getServiceName(), level: "error", error: String(error) }),
    );
  });

  setInterval(() => console.log(JSON.stringify(createHeartbeat())), 30000);
}
