import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMigrations } from "./migrations.js";

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
});
