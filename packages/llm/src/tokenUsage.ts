import type { LLMMessage, LLMTokenUsage } from "./LLMClient.js";

const APPROX_CHARS_PER_TOKEN = 4;

export function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;

  const wordLike = normalized.match(/[\p{L}\p{N}_'-]+/gu)?.length ?? 0;
  const charEstimate = Math.ceil(normalized.length / APPROX_CHARS_PER_TOKEN);
  return Math.max(1, Math.max(wordLike, charEstimate));
}

export function estimatePromptTokens(messages: readonly LLMMessage[]): number {
  return messages.reduce((total, message) => total + estimateTokenCount(message.content) + 4, 0);
}

export function buildEstimatedUsage(
  messages: readonly LLMMessage[],
  completion: string,
): LLMTokenUsage {
  const promptTokens = estimatePromptTokens(messages);
  const completionTokens = estimateTokenCount(completion);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimated: true,
  };
}
