import { recommendationLatencyScenario } from "./incident-scenarios.js";
import { beautyCorpServices } from "./services.js";

export type SyntheticMetricPoint = {
  readonly serviceName: string;
  readonly timestamp: string;
  readonly metricName: string;
  readonly metricValue: number;
  readonly unit: string;
  readonly attributes: Record<string, string | number | boolean>;
};

export function generateMetricBatch(
  baseTime = new Date("2026-06-26T09:45:00.000Z"),
): SyntheticMetricPoint[] {
  const metrics: SyntheticMetricPoint[] = [];

  for (const service of beautyCorpServices) {
    const isRecommendation = service.name === "recommendation-service";
    const latencySeries = isRecommendation
      ? [420, 530, 880, 1260, 1710, 2130]
      : [110, 118, 121, 132, 128, 119];
    const errorSeries = isRecommendation
      ? [0.01, 0.015, 0.03, 0.08, 0.13, 0.18]
      : [0.002, 0.003, 0.002, 0.004, 0.003, 0.002];

    latencySeries.forEach((value, index) => {
      metrics.push({
        serviceName: service.name,
        timestamp: new Date(baseTime.getTime() + index * 120_000).toISOString(),
        metricName: "p95_latency_ms",
        metricValue: value,
        unit: "ms",
        attributes: {
          environment: "production",
          incidentScenarioId: isRecommendation ? recommendationLatencyScenario.id : "none",
          synthetic: true,
        },
      });
    });

    errorSeries.forEach((value, index) => {
      metrics.push({
        serviceName: service.name,
        timestamp: new Date(baseTime.getTime() + index * 120_000).toISOString(),
        metricName: "http_error_rate",
        metricValue: value,
        unit: "ratio",
        attributes: {
          environment: "production",
          incidentScenarioId: isRecommendation ? recommendationLatencyScenario.id : "none",
          synthetic: true,
        },
      });
    });
  }

  return metrics;
}
