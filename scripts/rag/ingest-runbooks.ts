import { createPool, getDatabaseUrl, runMigrations } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";

async function main(): Promise<void> {
  const pool = createPool({ connectionString: getDatabaseUrl() });
  try {
    await runMigrations(pool);
    const config = loadRagConfig();
    const service = new RunbookRagService(pool, createEmbeddingClient(config));
    const result = await service.ingest();
    console.log(JSON.stringify({ ...result, provider: config.provider }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
