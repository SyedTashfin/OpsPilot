export type ApiConfig = {
  readonly port: number;
  readonly databaseUrl: string;
  readonly ollamaBaseUrl: string;
  readonly langfuseBaseUrl: string;
  readonly autoMigrate: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? env.API_PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? "postgres://opspilot:opspilot@localhost:5432/opspilot",
    ollamaBaseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    langfuseBaseUrl: env.LANGFUSE_BASE_URL ?? "http://localhost:3001",
    autoMigrate: env.API_AUTO_MIGRATE !== "false",
  };
}
