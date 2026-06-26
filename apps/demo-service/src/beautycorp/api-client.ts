import type { SyntheticDeployment } from "./deployment-generator.js";
import type { IncidentScenario } from "./incident-scenarios.js";
import type { SyntheticLogEntry } from "./log-generator.js";
import type { SyntheticMetricPoint } from "./metrics-generator.js";
import type { BeautyCorpService } from "./services.js";

export type BeautyCorpTelemetryBatch = {
  readonly generatedAt: string;
  readonly services: readonly BeautyCorpService[];
  readonly deployments: readonly SyntheticDeployment[];
  readonly logs: readonly SyntheticLogEntry[];
  readonly metrics: readonly SyntheticMetricPoint[];
  readonly incidents: readonly IncidentScenario[];
};

export type PostTelemetryOptions = {
  readonly apiBaseUrl: string;
  readonly fetchImpl?: typeof fetch;
};

export async function postTelemetryBatch(
  batch: BeautyCorpTelemetryBatch,
  options: PostTelemetryOptions,
): Promise<void> {
  const fetcher = options.fetchImpl ?? fetch;
  const response = await fetcher(new URL("/api/demo/telemetry/batch", options.apiBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to post BeautyCorp telemetry: ${response.status} ${response.statusText} ${body}`.trim(),
    );
  }
}
