import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateVitestJsonResult } from "./validate-db-test-results.js";

let tempDirs: string[] = [];

function resultFile(payload: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "opspilot-db-result-"));
  tempDirs.push(dir);
  const file = path.join(dir, "result.json");
  writeFileSync(file, JSON.stringify(payload));
  return file;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    numTotalTests: 6,
    numPassedTests: 6,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    success: true,
    ...overrides,
  };
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("DB test result validator", () => {
  it("accepts the expected complete result", () => {
    const failures = validateVitestJsonResult({
      label: "migration suite",
      file: resultFile(payload()),
      expectedTests: 6,
    });
    expect(failures).toEqual([]);
  });

  it("rejects skipped tests", () => {
    const failures = validateVitestJsonResult({
      label: "migration suite",
      file: resultFile(payload({ numPassedTests: 5, numPendingTests: 1 })),
      expectedTests: 6,
    });
    expect(failures).toContain("migration suite: expected 6 passed tests, got 5");
    expect(failures).toContain("migration suite: expected 0 skipped/pending tests, got 1");
  });

  it("rejects the wrong collected count", () => {
    const failures = validateVitestJsonResult({
      label: "migration suite",
      file: resultFile(payload({ numTotalTests: 5 })),
      expectedTests: 6,
    });
    expect(failures).toEqual(["migration suite: expected 6 collected tests, got 5"]);
  });

  it("rejects failed or unsuccessful results", () => {
    const failures = validateVitestJsonResult({
      label: "API integration suite",
      file: resultFile(
        payload({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1, success: false }),
      ),
      expectedTests: 1,
    });
    expect(failures).toContain("API integration suite: success must be true");
    expect(failures).toContain("API integration suite: expected 1 passed tests, got 0");
    expect(failures).toContain("API integration suite: expected 0 failed tests, got 1");
  });

  it("rejects malformed or missing result files", () => {
    const malformed = resultFile("not valid shape");
    writeFileSync(malformed, "{not-json");
    expect(
      validateVitestJsonResult({ label: "migration suite", file: malformed, expectedTests: 6 }),
    ).toEqual(["migration suite: result file is not valid JSON"]);
    expect(
      validateVitestJsonResult({
        label: "migration suite",
        file: `${malformed}.missing`,
        expectedTests: 6,
      }),
    ).toEqual(["migration suite: missing result file"]);
  });
});
