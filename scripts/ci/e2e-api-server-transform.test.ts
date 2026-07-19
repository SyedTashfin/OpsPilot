import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("E2E API launcher", () => {
  it("can be imported through root tsx/CommonJS transform without starting a live server", () => {
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "-e",
        "import('./e2e/api-server.ts').then((module) => { if (typeof module.createE2EApiServer !== 'function' || typeof module.main !== 'function') process.exit(1); })",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain("Top-level await");
  });
});
