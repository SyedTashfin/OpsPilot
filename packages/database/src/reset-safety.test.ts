import { afterEach, describe, expect, it, vi } from "vitest";
import { assertResetDatabaseAllowed, resetDatabase } from "./index.js";

const optIn = { NODE_ENV: "development", OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test" };
const testOptIn = { NODE_ENV: "test", OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test" };

type FakePool = {
  readonly query: ReturnType<typeof vi.fn>;
  readonly options: Record<string, unknown>;
};

function fakePool(options: Record<string, unknown>): FakePool {
  return { query: vi.fn(), options };
}

function stubResetEnv(env: Record<string, string | undefined>) {
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  vi.stubEnv("CI", env.CI);
  vi.stubEnv("OPSPILOT_ALLOW_DATABASE_RESET", env.OPSPILOT_ALLOW_DATABASE_RESET);
}

async function expectResetRejected(pool: FakePool): Promise<Error> {
  let caught: unknown;
  try {
    await resetDatabase(pool as never);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(pool.query).not.toHaveBeenCalled();
  return caught as Error;
}

function reject(url: string | undefined, env: NodeJS.ProcessEnv = optIn) {
  expect(() => assertResetDatabaseAllowed(url, env)).toThrow(/Database reset refused/);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database reset safety", () => {
  it("accepts local loopback with explicit development signal and OpsPilot database", () => {
    expect(() =>
      assertResetDatabaseAllowed("postgres://user:pass@localhost:5432/opspilot", optIn),
    ).not.toThrow();
    expect(() =>
      assertResetDatabaseAllowed("postgresql://127.0.0.1:5432/opspilot", optIn),
    ).not.toThrow();
  });

  it("accepts confirmed Docker host only under allowed dev/test/CI signals", () => {
    expect(() =>
      assertResetDatabaseAllowed(
        "postgres://opspilot:opspilot@opspilot-postgres:5432/opspilot",
        optIn,
      ),
    ).not.toThrow();
    reject("postgres://opspilot:opspilot@postgres:5432/opspilot", optIn);
    reject("postgres://opspilot:opspilot@db:5432/opspilot", optIn);
    reject("postgres://opspilot:opspilot@opspilot-postgres:5432/opspilot", {
      NODE_ENV: "staging",
      OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test",
    });
  });

  it("accepts CI host only under CI test signal", () => {
    expect(() =>
      assertResetDatabaseAllowed("postgres://opspilot@postgres:5432/opspilot_test", {
        ...testOptIn,
        CI: "true",
      }),
    ).not.toThrow();
    reject("postgres://opspilot@postgres:5432/opspilot_test", testOptIn);
  });

  it("rejects production, missing, managed, remote, malformed, unsupported, and unsafe database targets", () => {
    reject("postgres://localhost/opspilot", {
      NODE_ENV: "production",
      OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test",
    });
    reject("postgres://localhost/opspilot", { OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test" });
    reject("postgres://u:p@example.rds.amazonaws.com:5432/opspilot", optIn);
    reject("postgres://u:p@10.0.0.4:5432/opspilot", optIn);
    reject("not a url", optIn);
    reject("mysql://localhost/opspilot", optIn);
    reject("postgres://localhost/postgres", optIn);
    reject("postgres://localhost/arbitrary", optIn);
    reject(undefined, optIn);
  });

  it("does not print credential-bearing URLs and rejects before destructive SQL", async () => {
    stubResetEnv(optIn);
    const pool = fakePool({
      connectionString:
        "postgres://secret-user:secret-pass@example.rds.amazonaws.com:5432/opspilot?sslmode=require&token=secret-token",
    });

    const error = await expectResetRejected(pool);

    expect(error.message).toBe(
      "Database reset refused: hosted or managed database targets are not allowed.",
    );
    expect(error.message).not.toMatch(
      /secret-user|secret-pass|sslmode|secret-token|example\.rds\.amazonaws\.com/,
    );
  });

  it("derives the guarded target from the actual pool and exposes no public env or target override", async () => {
    stubResetEnv(optIn);
    const pool = fakePool({ connectionString: "postgres://u:p@10.0.0.4:5432/opspilot" });

    const error = await expectResetRejected(pool);

    expect(resetDatabase).toHaveLength(1);
    expect(error.message).toBe(
      "Database reset refused: target host is not an allowed local, Docker development, or CI database host.",
    );
  });

  it("uses real process.env for destructive execution and refuses production before query", async () => {
    stubResetEnv({ NODE_ENV: "production", OPSPILOT_ALLOW_DATABASE_RESET: "local-dev-or-test" });
    const pool = fakePool({ connectionString: "postgres://localhost/opspilot" });

    const error = await expectResetRejected(pool);

    expect(error.message).toBe("Database reset refused: production environment.");
  });

  it("supports discrete local pool options under real test env", async () => {
    stubResetEnv(testOptIn);
    const allowedPool = fakePool({ host: "localhost", port: 5432, database: "opspilot_test" });

    await resetDatabase(allowedPool as never);

    expect(allowedPool.query).toHaveBeenCalledWith(
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    );
  });
});
