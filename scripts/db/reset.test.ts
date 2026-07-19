import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { assertResetDatabaseAllowed } from "../../packages/database/src/index.js";

const execFileAsync = promisify(execFile);
const safeLocalEnv = {
  NODE_ENV: "development",
  OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test",
  DATABASE_URL: "postgres://opspilot:opspilot@localhost:5432/opspilot",
};

describe("reset CLI safety", () => {
  it("refuses before connecting when the documented opt-in is absent", async () => {
    let caught: unknown;
    try {
      await execFileAsync("pnpm", ["tsx", "scripts/db/reset.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "development",
          DATABASE_URL: safeLocalEnv.DATABASE_URL,
          OPSPILOT_ALLOW_DATABASE_RESET: "",
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: 1 });
    const output = `${(caught as { stdout?: string; stderr?: string }).stdout ?? ""}${(caught as { stdout?: string; stderr?: string }).stderr ?? ""}`;
    expect(output).toContain("Database reset refused");
    expect(output).not.toContain(safeLocalEnv.DATABASE_URL);
  });

  it("documents a narrow local/test configuration that the shared guard accepts", () => {
    expect(() => assertResetDatabaseAllowed(safeLocalEnv.DATABASE_URL, safeLocalEnv)).not.toThrow();
  });
});
