import pg from "pg";

const { Pool } = pg;

export type DatabaseConfig = {
  readonly connectionString: string;
};

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the OpsPilot database.");
  }

  return databaseUrl;
}

export function createPool(
  config: DatabaseConfig = { connectionString: getDatabaseUrl() },
): pg.Pool {
  return new Pool({
    connectionString: config.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function withDatabase<T>(
  operation: (pool: pg.Pool) => Promise<T>,
  config?: DatabaseConfig,
): Promise<T> {
  const pool = createPool(config);

  try {
    return await operation(pool);
  } finally {
    await pool.end();
  }
}
