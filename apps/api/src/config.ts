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
  readonly portfolioAccessCode: string | undefined;
  readonly sessionSecret: string | undefined;
  readonly allowedOrigins: readonly string[];
  readonly authRequired: boolean;
};

function normalizeOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("API_ALLOWED_ORIGINS contains an invalid origin.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API_ALLOWED_ORIGINS must contain only http(s) origins.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "API_ALLOWED_ORIGINS must contain bare origins without credentials, paths, query, or fragments.",
    );
  }
  return url.origin;
}

function parseAllowedOrigins(env: NodeJS.ProcessEnv): readonly string[] {
  const configured = env.API_ALLOWED_ORIGINS;
  if (!configured && env.NODE_ENV !== "production") return ["http://localhost:3000"];
  const origins = (configured ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.includes("*") || origins.includes("null")) {
    throw new Error("API_ALLOWED_ORIGINS must not use wildcard or opaque origins.");
  }
  return [...new Set(origins.map(normalizeOrigin))];
}

function cleanSecret(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const allowedOrigins = parseAllowedOrigins(env);
  const authRequired = env.OPSPILOT_AUTH_REQUIRED !== "false";
  const portfolioAccessCode = cleanSecret(env.OPSPILOT_PORTFOLIO_ACCESS_CODE);
  const sessionSecret = cleanSecret(env.OPSPILOT_SESSION_SECRET);
  if (env.NODE_ENV === "production") {
    if (authRequired && (!portfolioAccessCode || !sessionSecret)) {
      throw new Error("Production auth requires configured access code and session secret.");
    }
    if (authRequired && portfolioAccessCode && portfolioAccessCode.length < 12) {
      throw new Error("Production portfolio access code is too weak.");
    }
    if (authRequired && sessionSecret && sessionSecret.length < 32) {
      throw new Error("Production session secret is too weak.");
    }
    if (allowedOrigins.length === 0) {
      throw new Error("Production CORS requires explicit API_ALLOWED_ORIGINS.");
    }
  }
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
    portfolioAccessCode,
    sessionSecret,
    allowedOrigins,
    authRequired,
  };
}
