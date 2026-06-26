import type { LLMMessage } from "../LLMClient.js";

export type EvaluationPromptInput = {
  readonly expectedFinding: string;
  readonly actualFinding: string;
};

export function buildEvaluationPrompt(input: EvaluationPromptInput): readonly LLMMessage[] {
  return [
    {
      role: "system",
      content:
        "You evaluate OpsPilot investigation answers. Score factual alignment with the expected finding and explain gaps briefly.",
    },
    {
      role: "user",
      content: [
        "Evaluate the investigation output.",
        "",
        `Expected finding:\n${input.expectedFinding}`,
        "",
        `Actual finding:\n${input.actualFinding}`,
        "",
        "Return JSON with score from 0 to 1 and a short rationale.",
      ].join("\n"),
    },
  ];
}
