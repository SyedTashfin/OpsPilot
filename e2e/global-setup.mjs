import { createPool, resetDatabase, runMigrations, runSeed } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";

export async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.OPSPILOT_ALLOW_DATABASE_RESET = "local-dev-or-test";
  const pool = createPool({
    connectionString:
      process.env.OPSPILOT_TEST_DATABASE_URL ??
      "postgres://opspilot:opspilot@localhost:5432/opspilot_test",
  });
  try {
    await resetDatabase(pool);
    await runMigrations(pool);
    await runSeed(pool);
    const rag = new RunbookRagService(
      pool,
      createEmbeddingClient(loadRagConfig({ RAG_EMBEDDING_PROVIDER: "deterministic" })),
    );
    await rag.ingest();
  } finally {
    await pool.end();
  }
}

export default globalSetup;
