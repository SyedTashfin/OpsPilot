import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function safeChildOutput(stdout: string | null, stderr: string | null): string {
  return `${stdout ?? ""}${stderr ?? ""}`.replace(
    /(opspilot_session|x-csrf-token)=\S+/giu,
    "$1=<redacted>",
  );
}

describe("E2E API launcher", () => {
  it("can be imported through root tsx/CommonJS transform without starting a live server", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "-e", "import('./e2e/api-server.ts').then(() => undefined)"],
      { encoding: "utf8", timeout: 10_000 },
    );
    const output = safeChildOutput(result.stdout, result.stderr);
    expect(result.status, `tsx import failed or hung. Output:\n${output}`).toBe(0);
    expect(output).not.toContain("Top-level await");
  });
});
