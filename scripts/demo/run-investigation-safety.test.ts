import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assertResetDatabaseAllowed } from "../../packages/database/src/index.js";

const documentedSafeDemoEnv = {
  NODE_ENV: "development",
  OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test",
  DATABASE_URL: "postgres://opspilot:opspilot@localhost:5432/opspilot",
};

describe("run-investigation demo reset safety", () => {
  it("refuses the demo reset target without the explicit local-only opt-in", () => {
    expect(() =>
      assertResetDatabaseAllowed(documentedSafeDemoEnv.DATABASE_URL, {
        NODE_ENV: "development",
      }),
    ).toThrow(/Database reset refused/);
  });

  it("accepts only the documented safe local/test demo reset configuration", () => {
    expect(() =>
      assertResetDatabaseAllowed(documentedSafeDemoEnv.DATABASE_URL, documentedSafeDemoEnv),
    ).not.toThrow();
    expect(() =>
      assertResetDatabaseAllowed(
        "postgres://opspilot:opspilot@localhost:5432/postgres",
        documentedSafeDemoEnv,
      ),
    ).toThrow(/Database reset refused/);
  });

  it("delegates destructive reset to central resetDatabase without a local SQL bypass", async () => {
    const source = await readFile("scripts/demo/run-investigation.ts", "utf8");

    expect(source).toContain("resetDatabase(pool)");
    expect(source).not.toMatch(/DROP\s+SCHEMA|TRUNCATE|DROP\s+DATABASE/i);
    expect(source).not.toContain("OPSPILOT_ALLOW_DATABASE_RESET=local-dev-or-test");
  });
});
