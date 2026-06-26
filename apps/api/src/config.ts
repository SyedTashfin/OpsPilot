import { LLMProviderSchema } from "@opspilot/llm";

export type ApiConfig = {
  readonly port: number;
  readonly databaseUrl: string;
  readonly ollamaBaseUrl: string;
  readonly langfuseBaseUrl: string;
  readonly autoMigrate: boolean;
  readonly llmProvider: "ollama" | "gemini";
  readonly ollamaModel: string;
  readonly llmCredential: string | undefined;
  readonly geminiModel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? env.API_PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? "postgres://opspilot:opspilot@localhost:5432/opspilot",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    langfuseBaseUrl: env.LANGFUSE_BASE_URL ?? "http://localhost:3001",
    autoMigrate: env.API_AUTO_MIGRATE !== "false",
    llmProvider: LLMProviderSchema.parse(env.LLM_PROVIDER ?? "ollama"),
    ollamaModel: env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct",
    llmCredential: env.GEMINI_API_KEY || undefined,
    geminiModel: env.GEMINI_MODEL ?? "gemini-1.5-flash",
  };
}
