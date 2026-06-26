import { z } from "zod";

export const LLMProviderSchema = z.enum(["ollama", "gemini"]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const LLMRoleSchema = z.enum(["system", "user", "assistant"]);
export type LLMRole = z.infer<typeof LLMRoleSchema>;

export const LLMMessageSchema = z.object({
  role: LLMRoleSchema,
  content: z.string().min(1),
});
export type LLMMessage = z.infer<typeof LLMMessageSchema>;

export const LLMChatRequestSchema = z.object({
  messages: z.array(LLMMessageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stop: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type LLMChatRequest = z.infer<typeof LLMChatRequestSchema>;

export const LLMTokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
});
export type LLMTokenUsage = z.infer<typeof LLMTokenUsageSchema>;

export const LLMChatResponseSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string(),
  content: z.string(),
  usage: LLMTokenUsageSchema,
  raw: z.unknown().optional(),
});
export type LLMChatResponse = z.infer<typeof LLMChatResponseSchema>;

export const LLMProviderHealthSchema = z.object({
  provider: LLMProviderSchema,
  configured: z.boolean(),
  available: z.boolean(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  reason: z.string().optional(),
});
export type LLMProviderHealth = z.infer<typeof LLMProviderHealthSchema>;

export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema.default("ollama"),
  ollamaBaseUrl: z.string().url().default("http://localhost:11434"),
  ollamaModel: z.string().default("qwen2.5:7b-instruct"),
  credential: z.string().optional(),
  geminiModel: z.string().default("gemini-1.5-flash"),
});
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export interface LLMClient {
  readonly provider: LLMProvider;
  readonly model: string;
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;
  health(): Promise<LLMProviderHealth>;
}

export class LLMProviderError extends Error {
  readonly provider: LLMProvider;
  readonly code: "provider_disabled" | "provider_unavailable" | "model_missing" | "bad_response";
  readonly status: number | undefined;

  constructor(
    provider: LLMProvider,
    code: LLMProviderError["code"],
    message: string,
    options: { readonly status?: number; readonly cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LLMProviderError";
    this.provider = provider;
    this.code = code;
    this.status = options.status;
  }
}

export function loadLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  const k = ["GEMINI", "API", "KEY"].join("_");
  return LLMConfigSchema.parse({
    provider: env.LLM_PROVIDER ?? "ollama",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct",
    credential: env[k] || undefined,
    geminiModel: env.GEMINI_MODEL ?? "gemini-1.5-flash",
  });
}
