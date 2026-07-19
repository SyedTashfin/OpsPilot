export type HiddenInvestigationGroundTruth = {
  readonly incidentId: string;
  readonly expectedConclusion: string;
  readonly expectedEvidence: readonly string[];
  readonly contributingFactors: readonly string[];
  readonly confidence: number;
  readonly classification: "true_positive" | "false_positive";
};

export const recommendationLatencyGroundTruth: HiddenInvestigationGroundTruth = {
  incidentId: "beautycorp-rec-latency-2026-06-26",
  expectedConclusion:
    "Deployment rec-2026.06.1 changed feature-store timeout and retry behavior, causing retry amplification and elevated p95 latency.",
  expectedEvidence: ["p95_latency_ms", "feature_store_timeout", "retry_count", "rec-2026.06.1"],
  contributingFactors: [
    "lower timeout budget",
    "elevated retries",
    "post-deployment latency spike",
  ],
  confidence: 0.86,
  classification: "true_positive",
};
