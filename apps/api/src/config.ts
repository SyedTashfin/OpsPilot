import { LLMProviderSchema } from "@opspilot/llm";

export type ApiConfig = {
  readonly port: number;
  readonly databaseUrl: string;
  readonly ollamaBaseUrl: string;
  readonly langfuseBaseUrl: string;
  readonly langfusePublicKey: string | undefined;
  readonly langfuseSecretKey: string | undefined;
  readonly langfuseEnabled: boolean | undefined;
  readonly langfuseEnvironment: string;
  readonly autoMigrate: boolean;
  readonly llmProvider: "ollama" | "gemini";
  readonly ollamaModel: string;
  readonly llmTimeoutMs: number;
  readonly llmCredential: string | undefined;
  readonly geminiModel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? env.API_PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? "postgres://opspilot:opspilot@localhost:5432/opspilot",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    langfuseBaseUrl: env.LANGFUSE_BASE_URL ?? "http://localhost:3001",
    langfusePublicKey: env.LANGFUSE_PUBLIC_KEY || undefined,
    langfuseSecretKey: env.LANGFUSE_SECRET_KEY || undefined,
    langfuseEnabled: env.LANGFUSE_ENABLED ? env.LANGFUSE_ENABLED !== "false" : undefined,
    langfuseEnvironment: env.LANGFUSE_ENVIRONMENT ?? env.NODE_ENV ?? "development",
    autoMigrate: env.API_AUTO_MIGRATE !== "false",
    llmProvider: LLMProviderSchema.parse(env.LLM_PROVIDER ?? "ollama"),
    ollamaModel: env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct",
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS ?? 90_000),
    llmCredential: env.GEMINI_API_KEY || undefined,
    geminiModel: env.GEMINI_MODEL ?? "gemini-1.5-flash",
  };
}
