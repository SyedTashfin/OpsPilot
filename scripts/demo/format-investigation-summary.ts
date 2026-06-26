export type DemoReport = {
  readonly investigationId?: string;
  readonly incidentTitle?: string;
  readonly serviceName?: string;
  readonly summary?: string;
  readonly probableRootCause?: string;
  readonly confidence?: number;
  readonly evidence?: readonly { readonly source?: string; readonly detail?: string }[];
  readonly citedRunbooks?: readonly { readonly title?: string; readonly slug?: string }[];
  readonly recommendedNextDiagnostics?: readonly string[];
};

export function formatInvestigationSummary(report: DemoReport): string {
  const evidence =
    report.evidence
      ?.map((entry) => `- [${entry.source ?? "evidence"}] ${entry.detail ?? ""}`)
      .join("\n") ?? "- none";
  const runbooks =
    report.citedRunbooks
      ?.map((runbook) => `- ${runbook.title ?? runbook.slug ?? "runbook"}`)
      .join("\n") ?? "- none";
  const diagnostics =
    report.recommendedNextDiagnostics?.map((item) => `- ${item}`).join("\n") ?? "- none";

  return [
    "OpsPilot Investigation Demo",
    "===========================",
    `Investigation: ${report.investigationId ?? "unknown"}`,
    `Incident: ${report.incidentTitle ?? "unknown"}`,
    `Service: ${report.serviceName ?? "unknown"}`,
    `Confidence: ${typeof report.confidence === "number" ? report.confidence.toFixed(2) : "unknown"}`,
    "",
    "Summary",
    report.summary ?? "No summary returned.",
    "",
    "Probable root cause",
    report.probableRootCause ?? "No root cause returned.",
    "",
    "Evidence",
    evidence,
    "",
    "Cited runbooks",
    runbooks,
    "",
    "Recommended next diagnostics",
    diagnostics,
  ].join("\n");
}
