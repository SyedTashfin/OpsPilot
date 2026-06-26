import { createPool, runMigrations } from "../../packages/database/src/index.js";

async function main(): Promise<void> {
  const pool = createPool();

  try {
    const result = await runMigrations(pool);
    console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
