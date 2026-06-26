import { createPool, getDatabaseUrl } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) throw new Error('Usage: pnpm rag:search "feature store timeout"');

  const pool = createPool({ connectionString: getDatabaseUrl() });
  try {
    const config = loadRagConfig();
    const service = new RunbookRagService(pool, createEmbeddingClient(config));
    const results = await service.search(query, 5);
    console.log(JSON.stringify({ query, results }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
