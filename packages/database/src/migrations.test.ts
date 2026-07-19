import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  defaultMigrationsDirectory,
  defaultSeedsDirectory,
  listMigrations,
  resetDatabase,
  runMigrations,
  runSeed,
} from "./migrations.js";
import { createPool } from "./client.js";

describe("listMigrations", () => {
  it("loads sql migrations in lexicographic order and includes checksums", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "opspilot-migrations-"));
    await writeFile(path.join(directory, "0002_second.sql"), "SELECT 2;");
    await writeFile(path.join(directory, "0001_first.sql"), "SELECT 1;");
    await writeFile(path.join(directory, "README.md"), "not a migration");

    const migrations = await listMigrations(directory);

    expect(migrations.map((migration) => migration.name)).toEqual([
      "0001_first.sql",
      "0002_second.sql",
    ]);
    expect(migrations.every((migration) => migration.checksum.length === 64)).toBe(true);
  });

  it("keeps historical 0004 migration immutable and appends leakage sanitation as 0007", async () => {
    const migrations = await listMigrations(defaultMigrationsDirectory());
    const names = migrations.map((migration) => migration.name);
    const historicalSeed = migrations.find(
      (migration) => migration.name === "0004_seed_beautycorp.sql",
    );
    const sanitation = migrations.find(
      (migration) => migration.name === "0007_sanitize_synthetic_evaluation_leakage.sql",
    );

    expect(names).toEqual([
      "0001_enable_extensions.sql",
      "0002_core_schema.sql",
      "0003_indexes.sql",
      "0004_seed_beautycorp.sql",
      "0005_runbook_chunk_indexes.sql",
      "0006_drop_runbook_hnsw_index.sql",
      "0007_sanitize_synthetic_evaluation_leakage.sql",
      "0008_drop_runbook_ivfflat_index.sql",
    ]);
    expect(historicalSeed?.checksum).toBe(
      "34b4ed4b9cfc38769bc68045282a75a85b5999261311fb25d51d78ae5982dec6",
    );
    expect(historicalSeed?.sql).toContain("Common root cause:");
    expect(sanitation?.sql).toContain("suspected_root_cause = NULL");
    expect(sanitation?.sql).toContain("slug = 'recommendation-service-latency'");
    const exactSearch = migrations.find(
      (migration) => migration.name === "0008_drop_runbook_ivfflat_index.sql",
    );
    expect(exactSearch?.sql).toContain("DROP INDEX IF EXISTS idx_runbook_chunks_embedding");
  });

  it("runs the new migration after 0004 with checksum tracking through the migration runner", async () => {
    const queries: string[] = [];
    const client = {
      query: (sql: string, values?: readonly unknown[]) => {
        queries.push(values ? `${sql} ${JSON.stringify(values)}` : sql);
        if (sql.startsWith("SELECT name, checksum")) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
      },
      release() {},
    };
    const pool = { connect: () => Promise.resolve(client) };

    const result = await runMigrations(pool as never);

    expect(result.applied).toContain("0007_sanitize_synthetic_evaluation_leakage.sql");
    expect(result.applied).toContain("0008_drop_runbook_ivfflat_index.sql");
    expect(result.applied.indexOf("0004_seed_beautycorp.sql")).toBeLessThan(
      result.applied.indexOf("0007_sanitize_synthetic_evaluation_leakage.sql"),
    );
    expect(result.applied.indexOf("0007_sanitize_synthetic_evaluation_leakage.sql")).toBeLessThan(
      result.applied.indexOf("0008_drop_runbook_ivfflat_index.sql"),
    );
    expect(queries.some((query) => query.includes("suspected_root_cause = NULL"))).toBe(true);
    expect(
      queries.some((query) => query.includes("DROP INDEX IF EXISTS idx_runbook_chunks_embedding")),
    ).toBe(true);
    expect(queries.some((query) => query.includes('"0008_drop_runbook_ivfflat_index.sql"'))).toBe(
      true,
    );
  });

  it("uses current safe seed SQL instead of the historical checksum-tracked seed", async () => {
    const seedSql = await readFile(path.join(defaultSeedsDirectory(), "beautycorp.sql"), "utf8");
    const executedSql: string[] = [];
    const pool = { query: (sql: string) => Promise.resolve(executedSql.push(sql)) };

    await runSeed(pool as never);

    expect(executedSql).toEqual([seedSql]);
    expect(executedSql[0]).toContain("Diagnostic path:");
    expect(executedSql[0]).not.toContain("Common root cause:");
    expect(
      createHash("sha256")
        .update(executedSql[0] ?? "")
        .digest("hex"),
    ).not.toBe("34b4ed4b9cfc38769bc68045282a75a85b5999261311fb25d51d78ae5982dec6");
  });

  it("skips the exact-search reconciliation migration on rerun by ledger semantics", async () => {
    const migrations = await listMigrations(defaultMigrationsDirectory());
    const appliedRows = migrations.map((migration) => ({
      name: migration.name,
      checksum: migration.checksum,
      applied_at: new Date("2026-07-19T00:00:00.000Z"),
    }));
    const queries: string[] = [];
    const client = {
      query: (sql: string) => {
        queries.push(sql);
        if (sql.startsWith("SELECT name, checksum")) return Promise.resolve({ rows: appliedRows });
        return Promise.resolve({ rows: [] });
      },
      release() {},
    };
    const pool = { connect: () => Promise.resolve(client) };

    const result = await runMigrations(pool as never);

    expect(result.applied).toEqual([]);
    expect(result.skipped).toContain("0008_drop_runbook_ivfflat_index.sql");
    expect(
      queries.some((query) => query.includes("DROP INDEX IF EXISTS idx_runbook_chunks_embedding")),
    ).toBe(false);
  });
});

const describeWithDatabase =
  process.env.OPSPILOT_RUN_DB_TESTS === "true" ? describe : describe.skip;

describeWithDatabase("pgvector exact-search reconciliation migration", () => {
  let pool: ReturnType<typeof createPool>;
  let pre0008Directory: string;

  beforeAll(async () => {
    pool = createPool({
      connectionString:
        process.env.OPSPILOT_TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        "postgres://opspilot:opspilot@localhost:5432/opspilot_test",
    });
    pre0008Directory = await mkdtemp(path.join(tmpdir(), "opspilot-pre-0008-"));
    for (const migration of await listMigrations(defaultMigrationsDirectory())) {
      if (migration.name <= "0007_sanitize_synthetic_evaluation_leakage.sql") {
        await copyFile(
          path.join(defaultMigrationsDirectory(), migration.name),
          path.join(pre0008Directory, migration.name),
        );
      }
    }
  });

  afterAll(async () => {
    await pool?.end();
    if (pre0008Directory) await rm(pre0008Directory, { recursive: true, force: true });
  });

  it("transitions real pre-0008 IVFFlat state to exact-search schema without data loss", async () => {
    await resetDatabase(pool);
    const pre0008 = await runMigrations(pool, pre0008Directory);
    expect(pre0008.applied).toContain("0007_sanitize_synthetic_evaluation_leakage.sql");
    expect(pre0008.applied).not.toContain("0008_drop_runbook_ivfflat_index.sql");

    const indexBefore = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_runbook_chunks_embedding';",
    );
    expect(indexBefore.rows.map((row) => row.indexname)).toEqual(["idx_runbook_chunks_embedding"]);

    const service = await pool.query<{ id: string }>(
      `INSERT INTO beautycorp_services (name, display_name, description, owner_team, runtime, criticality)
       VALUES ('pgvector-transition-service', 'Pgvector Transition Service', 'Transition test service.', 'Platform', 'nodejs', 'low')
       RETURNING id;`,
    );
    const serviceId = service.rows[0]?.id;
    if (!serviceId) throw new Error("Expected service id.");
    const runbook = await pool.query<{ id: string }>(
      `INSERT INTO runbooks (service_id, title, slug, body, source_path)
       VALUES ($1, 'Pgvector Transition Runbook', 'pgvector-transition-runbook', 'unique pgvector transition sentinel alpha', 'test://pgvector-transition')
       RETURNING id;`,
      [serviceId],
    );
    const runbookId = runbook.rows[0]?.id;
    if (!runbookId) throw new Error("Expected runbook id.");
    const embedding = `[${[1, ...Array<number>(767).fill(0)].join(",")}]`;
    const chunk = await pool.query<{ id: string }>(
      `INSERT INTO runbook_chunks (runbook_id, chunk_index, content, embedding, metadata)
       VALUES ($1, 0, 'unique pgvector transition sentinel alpha', $2::vector, '{"source":"transition-test"}'::jsonb)
       RETURNING id;`,
      [runbookId, embedding],
    );
    const chunkId = chunk.rows[0]?.id;
    if (!chunkId) throw new Error("Expected chunk id.");

    const fingerprintBefore = await pool.query<{ fingerprint: string }>(
      `SELECT md5(r.id::text || ':' || c.id::text || ':' || r.body || ':' || c.content || ':' || c.embedding::text || ':' || c.metadata::text) AS fingerprint
       FROM runbooks r
       JOIN runbook_chunks c ON c.runbook_id = r.id
       WHERE r.id = $1 AND c.id = $2;`,
      [runbookId, chunkId],
    );
    expect(fingerprintBefore.rows[0]?.fingerprint).toEqual(expect.any(String));

    const full = await runMigrations(pool);
    expect(full.applied).toEqual(["0008_drop_runbook_ivfflat_index.sql"]);

    const indexAfter = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_runbook_chunks_embedding';",
    );
    expect(indexAfter.rows).toEqual([]);
    const fingerprintAfter = await pool.query<{ fingerprint: string }>(
      `SELECT md5(r.id::text || ':' || c.id::text || ':' || r.body || ':' || c.content || ':' || c.embedding::text || ':' || c.metadata::text) AS fingerprint
       FROM runbooks r
       JOIN runbook_chunks c ON c.runbook_id = r.id
       WHERE r.id = $1 AND c.id = $2;`,
      [runbookId, chunkId],
    );
    expect(fingerprintAfter.rows[0]?.fingerprint).toBe(fingerprintBefore.rows[0]?.fingerprint);

    const exactSearch = await pool.query<{
      chunk_id: string;
      slug: string;
      content: string;
      distance: number;
    }>(
      `SELECT c.id AS chunk_id, r.slug, c.content, c.embedding <=> $1::vector AS distance
       FROM runbook_chunks c
       JOIN runbooks r ON r.id = c.runbook_id
       WHERE c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $1::vector ASC
       LIMIT 1;`,
      [embedding],
    );
    expect(exactSearch.rows[0]).toMatchObject({
      chunk_id: chunkId,
      slug: "pgvector-transition-runbook",
      content: "unique pgvector transition sentinel alpha",
      distance: 0,
    });

    const rerun = await runMigrations(pool);
    expect(rerun.applied).toEqual([]);
    expect(rerun.skipped).toContain("0008_drop_runbook_ivfflat_index.sql");
  }, 60_000);
});
