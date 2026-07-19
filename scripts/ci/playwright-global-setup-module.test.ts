import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function safeChildOutput(stdout: string | null, stderr: string | null): string {
  return `${stdout ?? ""}${stderr ?? ""}`.replace(
    /(opspilot_session|x-csrf-token)=\S+/giu,
    "$1=<redacted>",
  );
}

describe("Playwright global setup module", () => {
  it("loads as native ESM from built workspace package exports without touching a database", () => {
    const result = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        "import('./e2e/global-setup.mjs').then((module) => { if (typeof module.default !== 'function' || typeof module.globalSetup !== 'function') process.exit(1); })",
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    const output = safeChildOutput(result.stdout, result.stderr);
    expect(result.status, `ESM import failed or hung. Output:\n${output}`).toBe(0);
    expect(output).not.toContain("exports is not defined");
  });
});
