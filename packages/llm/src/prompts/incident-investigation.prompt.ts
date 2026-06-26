import type { LLMMessage } from "../LLMClient.js";

export type IncidentInvestigationPromptInput = {
  readonly incidentSummary: string;
  readonly evidence: readonly string[];
  readonly runbookContext: readonly string[];
};

export function buildIncidentInvestigationPrompt(
  input: IncidentInvestigationPromptInput,
): readonly LLMMessage[] {
  return [
    {
      role: "system",
      content:
        "You are OpsPilot's incident investigation assistant. Produce conservative, evidence-backed analysis. Do not recommend remediation unless evidence supports it.",
    },
    {
      role: "user",
      content: [
        "Investigate this incident for BeautyCorp.",
        "",
        `Incident summary:\n${input.incidentSummary}`,
        "",
        `Evidence:\n${formatBullets(input.evidence)}`,
        "",
        `Runbook context:\n${formatBullets(input.runbookContext)}`,
        "",
        "Return: probable root cause, confidence, supporting evidence, and missing information.",
      ].join("\n"),
    },
  ];
}

function formatBullets(items: readonly string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None provided";
}
