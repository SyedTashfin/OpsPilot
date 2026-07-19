import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

export type Migration = {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
};

export type AppliedMigration = {
  readonly name: string;
  readonly checksum: string;
  readonly applied_at: Date;
};

export type MigrationResult = {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function defaultMigrationsDirectory(): string {
  return path.resolve(__dirname, "..", "migrations");
}

export async function listMigrations(
  migrationsDirectory = defaultMigrationsDirectory(),
): Promise<Migration[]> {
  const files = await fs.readdir(migrationsDirectory);
  const migrationFiles = files
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    migrationFiles.map(async (name) => {
      const sql = await fs.readFile(path.join(migrationsDirectory, name), "utf8");
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

export async function ensureMigrationTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function getAppliedMigrations(
  client: pg.PoolClient,
): Promise<Map<string, AppliedMigration>> {
  await ensureMigrationTable(client);
  const result = await client.query<AppliedMigration>(
    "SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name ASC;",
  );
  return new Map(result.rows.map((row) => [row.name, row]));
}

export async function runMigrations(
  pool: pg.Pool,
  migrationsDirectory = defaultMigrationsDirectory(),
): Promise<MigrationResult> {
  const migrations = await listMigrations(migrationsDirectory);
  const applied: string[] = [];
  const skipped: string[] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const appliedMigrations = await getAppliedMigrations(client);

    for (const migration of migrations) {
      const existing = appliedMigrations.get(migration.name);

      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Migration checksum mismatch for ${migration.name}. Refusing to continue because applied migrations are immutable.`,
          );
        }
        skipped.push(migration.name);
        continue;
      }

      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);", [
        migration.name,
        migration.checksum,
      ]);
      applied.push(migration.name);
    }

    await client.query("COMMIT");
    return { applied, skipped };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type ResetDatabaseEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "CI" | "OPSPILOT_ALLOW_DATABASE_RESET">
>;

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const dockerDevelopmentHosts = new Set(["opspilot-postgres"]);
const ciHosts = new Set(["postgres", "localhost", "127.0.0.1", "::1", "[::1]"]);
const allowedDatabaseNames = new Set([
  "opspilot",
  "opspilot_test",
  "opspilot-test",
  "opspilot_ci",
  "opspilot-ci",
]);
const productionLabels = new Set(["production", "prod"]);
const managedHostnamePatterns = [
  /\.rds\.amazonaws\.com$/i,
  /\.database\.azure\.com$/i,
  /\.postgres\.database\.azure\.com$/i,
  /\.cloudsql\./i,
  /\.supabase\.(co|com)$/i,
  /\.neon\.tech$/i,
  /\.render\.com$/i,
  /\.railway\.app$/i,
  /\.herokuapp\.com$/i,
];

export function assertResetDatabaseAllowed(
  connectionString: string | undefined,
  env: ResetDatabaseEnvironment = process.env,
): void {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const ci = env.CI === "true";
  const override = env.OPSPILOT_ALLOW_DATABASE_RESET === "local-dev-or-test";

  if (!connectionString) throw new Error("Database reset refused: missing database target.");
  if (!nodeEnv)
    throw new Error("Database reset refused: NODE_ENV must explicitly be development or test.");
  if (productionLabels.has(nodeEnv))
    throw new Error("Database reset refused: production environment.");
  if (!override) {
    throw new Error(
      "Database reset refused: set OPSPILOT_ALLOW_DATABASE_RESET=local-dev-or-test for local/test resets.",
    );
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Database reset refused: database target is not a valid URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database reset refused: database target protocol must be postgres.");
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("Database reset refused: database target host is missing.");
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!allowedDatabaseNames.has(databaseName)) {
    throw new Error(
      "Database reset refused: database name is not an allowed OpsPilot local/test database.",
    );
  }
  if (managedHostnamePatterns.some((pattern) => pattern.test(host))) {
    throw new Error("Database reset refused: hosted or managed database targets are not allowed.");
  }

  const isLoopback = loopbackHosts.has(host);
  const isDockerDev = dockerDevelopmentHosts.has(host);
  const isCiHost = ciHosts.has(host);
  const remoteIp = /^\d+\.\d+\.\d+\.\d+$/.test(host) && !loopbackHosts.has(host);
  const allowedDev = nodeEnv === "development" && (isLoopback || isDockerDev);
  const allowedTest = nodeEnv === "test" && (isLoopback || isDockerDev || (ci && isCiHost));
  const allowedCi = ci && nodeEnv === "test" && isCiHost;

  if (remoteIp || !(allowedDev || allowedTest || allowedCi)) {
    throw new Error(
      "Database reset refused: target host is not an allowed local, Docker development, or CI database host.",
    );
  }
}

export async function resetDatabase(pool: pg.Pool): Promise<void> {
  const connectionString = getPoolConnectionTarget(pool);
  assertResetDatabaseAllowed(connectionString, process.env);
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
}

function getPoolConnectionTarget(pool: pg.Pool): string | undefined {
  if (pool.options.connectionString) return pool.options.connectionString;
  const host = pool.options.host;
  const database = pool.options.database;
  if (!host || !database) return undefined;
  const protocol = "postgres";
  const port = pool.options.port ? `:${pool.options.port}` : "";
  return `${protocol}://${host}${port}/${database}`;
}

export function defaultSeedsDirectory(): string {
  return path.resolve(__dirname, "..", "seeds");
}

export async function runSeed(
  pool: pg.Pool,
  seedsDirectory = defaultSeedsDirectory(),
): Promise<void> {
  const seedSqlPath = path.join(seedsDirectory, "beautycorp.sql");
  const seedSql = await fs.readFile(seedSqlPath, "utf8");
  await pool.query(seedSql);
}
