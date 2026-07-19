import { createPool, resetDatabase, runMigrations, runSeed } from "@opspilot/database";
import { RunbookRagService, createEmbeddingClient, loadRagConfig } from "@opspilot/rag";

async function seedDeterministicTelemetry(pool) {
  const [{ buildTelemetrySnapshot }, { DemoRepository }, { LogRepository }] = await Promise.all([
    import("../apps/demo-service/dist/main.js"),
    import("../apps/api/dist/modules/demo/demo.repository.js"),
    import("../apps/api/dist/modules/logs/log.repository.js"),
  ]);
  const snapshot = buildTelemetrySnapshot(new Date("2026-06-26T09:45:00.000Z"));
  const demo = new DemoRepository(pool);
  const logs = new LogRepository(pool);
  await demo.upsertServices(snapshot.services);
  await demo.upsertDeployments(snapshot.deployments);
  await logs.insertBatch(snapshot.logs);
  await demo.insertMetrics(snapshot.metrics);
  const incidents = await demo.upsertIncidents(snapshot.incidents);
  if (incidents < 1) {
    throw new Error("E2E setup did not persist a synthetic incident.");
  }
}

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
    await seedDeterministicTelemetry(pool);
  } finally {
    await pool.end();
  }
}

export default globalSetup;
