import type { InvestigationReport } from "../../src/modules/investigations/investigation.types.js";
import type { HiddenInvestigationGroundTruth } from "./recommendation-latency-ground-truth.test-support.js";

export type EvaluationReport = {
  readonly expectedConclusion: string;
  readonly actualConclusion: string;
  readonly citedEvidence: readonly string[];
  readonly passed: boolean;
  readonly confidence: number;
  readonly unsupportedClaims: readonly string[];
};

export function evaluateInvestigationReport(
  report: InvestigationReport,
  groundTruth: HiddenInvestigationGroundTruth,
): EvaluationReport {
  const actual = report.probableRootCause.toLowerCase();
  const citedEvidence = report.evidence.map((entry) => entry.reference);
  const unsupportedClaims = report.evidence
    .filter(
      (entry) =>
        !groundTruth.expectedEvidence.some((expected) => entry.reference.includes(expected)),
    )
    .map((entry) => entry.detail);
  const passed =
    actual.includes("rec-2026.06.1") &&
    actual.includes("feature-store") &&
    groundTruth.expectedEvidence.every((expected) =>
      citedEvidence.some((reference) => reference.includes(expected)),
    ) &&
    unsupportedClaims.length === 0 &&
    report.confidence >= 0.7;

  return {
    expectedConclusion: groundTruth.expectedConclusion,
    actualConclusion: report.probableRootCause,
    citedEvidence,
    passed,
    confidence: report.confidence,
    unsupportedClaims,
  };
}
