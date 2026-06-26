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

export async function resetDatabase(pool: pg.Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
}

export async function runSeed(
  pool: pg.Pool,
  migrationsDirectory = defaultMigrationsDirectory(),
): Promise<void> {
  const seedSqlPath = path.join(migrationsDirectory, "0004_seed_beautycorp.sql");
  const seedSql = await fs.readFile(seedSqlPath, "utf8");
  await pool.query(seedSql);
}
