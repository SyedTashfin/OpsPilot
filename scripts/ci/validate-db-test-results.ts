import { existsSync, readFileSync } from "node:fs";

type VitestJsonResult = {
  readonly numTotalTests?: unknown;
  readonly numPassedTests?: unknown;
  readonly numFailedTests?: unknown;
  readonly numPendingTests?: unknown;
  readonly numTodoTests?: unknown;
  readonly success?: unknown;
};

export type DbResultExpectation = {
  readonly label: string;
  readonly file: string;
  readonly expectedTests: number;
};

export function validateVitestJsonResult(expectation: DbResultExpectation): string[] {
  const failures: string[] = [];
  if (!existsSync(expectation.file)) return [`${expectation.label}: missing result file`];
  let parsed: VitestJsonResult;
  try {
    parsed = JSON.parse(readFileSync(expectation.file, "utf8")) as VitestJsonResult;
  } catch {
    return [`${expectation.label}: result file is not valid JSON`];
  }
  const fields: Array<keyof VitestJsonResult> = [
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ];
  for (const field of fields) {
    if (!Number.isInteger(parsed[field]))
      failures.push(`${expectation.label}: ${field} is missing or invalid`);
  }
  if (failures.length) return failures;
  const total = parsed.numTotalTests as number;
  const passed = parsed.numPassedTests as number;
  const failed = parsed.numFailedTests as number;
  const pending = parsed.numPendingTests as number;
  const todo = parsed.numTodoTests as number;
  if (parsed.success !== true) failures.push(`${expectation.label}: success must be true`);
  if (total !== expectation.expectedTests) {
    failures.push(
      `${expectation.label}: expected ${expectation.expectedTests} collected tests, got ${total}`,
    );
  }
  if (passed !== expectation.expectedTests) {
    failures.push(
      `${expectation.label}: expected ${expectation.expectedTests} passed tests, got ${passed}`,
    );
  }
  if (failed !== 0) failures.push(`${expectation.label}: expected 0 failed tests, got ${failed}`);
  if (pending !== 0)
    failures.push(`${expectation.label}: expected 0 skipped/pending tests, got ${pending}`);
  if (todo !== 0) failures.push(`${expectation.label}: expected 0 todo tests, got ${todo}`);
  return failures;
}

export function validateDbResultFiles(expectations: readonly DbResultExpectation[]): void {
  const failures = expectations.flatMap(validateVitestJsonResult);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(
    expectations
      .map(
        (expectation) =>
          `${expectation.label}: ${expectation.expectedTests}/${expectation.expectedTests} passed, 0 skipped`,
      )
      .join("\n"),
  );
}

if (process.argv[1]?.endsWith("validate-db-test-results.ts")) {
  validateDbResultFiles([
    { label: "migration suite", file: ".ci-results/db-migrations.json", expectedTests: 6 },
    {
      label: "API integration suite",
      file: ".ci-results/db-api-integration.json",
      expectedTests: 1,
    },
  ]);
}
