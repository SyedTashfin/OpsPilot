import { createPool, runSeed } from "../../packages/database/src/index.js";

async function main(): Promise<void> {
  const pool = createPool();

  try {
    await runSeed(pool);
    console.log(JSON.stringify({ status: "ok", seeded: "beautycorp" }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
