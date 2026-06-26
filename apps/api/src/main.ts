import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

export function getServiceName(): string {
  return "@opspilot/api";
}

export function createHealthResponse(): Record<string, string> {
  return { service: getServiceName(), status: "ready" };
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer(config);
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
