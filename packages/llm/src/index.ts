export * from "./LLMClient.js";
export * from "./geminiClient.js";
export * from "./instrumentedLLMClient.js";
export * from "./ollamaClient.js";
export * from "./prompts/evaluation.prompt.js";
export * from "./prompts/incident-investigation.prompt.js";
export * from "./tokenUsage.js";

import { GeminiClient } from "./geminiClient.js";
import type { LLMClient, LLMConfig } from "./LLMClient.js";
import { loadLLMConfig } from "./LLMClient.js";
import { OllamaClient } from "./ollamaClient.js";

export function createLLMClient(config: LLMConfig = loadLLMConfig()): LLMClient {
  if (config.provider === "gemini") {
    return new GeminiClient({ credential: config.credential, model: config.geminiModel });
  }

  return new OllamaClient({ baseUrl: config.ollamaBaseUrl, model: config.ollamaModel });
}

export const packageName = "@opspilot/llm" as const;

export function describePackage(): string {
  return "LLM provider interfaces and clients.";
}
