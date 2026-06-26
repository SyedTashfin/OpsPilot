import type { LLMMessage } from "@opspilot/llm";
import type { InvestigationContext } from "./investigation.types.js";

export const INVESTIGATION_PROMPT_VERSION = "incident-investigation-v1";

export function buildInvestigationPrompt(context: InvestigationContext): readonly LLMMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are OpsPilot's incident investigation agent.",
        "Use only the evidence provided in the prompt.",
        "Do not invent logs, metrics, deployments, runbooks, timestamps, causes, or remediation actions.",
        "If evidence is insufficient, say so in recommendedNextDiagnostics.",
        "Every conclusion must be supported by evidence entries or cited runbook sections.",
        "Return only valid JSON matching the requested schema.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Investigate the incident and identify the most probable root cause.",
          requiredToolSequenceAlreadyCompleted: [
            "query_logs",
            "query_metrics",
            "get_deployments",
            "search_runbooks",
          ],
          outputSchema: {
            summary: "string",
            probableRootCause: "string",
            confidence: "number between 0 and 1",
            evidence: [
              {
                source: "log | metric | deployment | runbook",
                reference: "stable id, metric name, deployment version, or runbook slug",
                detail: "specific evidence supporting the conclusion",
              },
            ],
            citedRunbooks: [
              {
                title: "string",
                slug: "string",
                chunkId: "string",
                quote: "exact relevant excerpt",
              },
            ],
            recommendedNextDiagnostics: ["string"],
          },
          incident: context.incident,
          deploymentHistory: context.deployments,
          relevantLogs: context.logs,
          metricSummaries: context.metrics,
          retrievedRunbookExcerpts: context.runbooks,
          constraints: [
            "No remediation actions.",
            "No infrastructure changes.",
            "No speculative fixes.",
            "Cite supporting evidence for every conclusion.",
          ],
        },
        null,
        2,
      ),
    },
  ];
}
