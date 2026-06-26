import { createPool, resetDatabase, runMigrations } from "../../packages/database/src/index.js";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset database when NODE_ENV=production.");
  }

  const pool = createPool();

  try {
    await resetDatabase(pool);
    const result = await runMigrations(pool);
    console.log(JSON.stringify({ status: "ok", reset: true, ...result }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
