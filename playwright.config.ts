import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? 4300);
const webPort = Number(process.env.E2E_WEB_PORT ?? 3300);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `NODE_ENV=development PORT=${apiPort} API_PORT=${apiPort} DATABASE_URL=${process.env.OPSPILOT_TEST_DATABASE_URL ?? "postgres://opspilot:opspilot@localhost:5432/opspilot_test"} API_ALLOWED_ORIGINS=http://127.0.0.1:${webPort} OPSPILOT_AUTH_REQUIRED=true OPSPILOT_PORTFOLIO_ACCESS_CODE=e2e-local-code OPSPILOT_SESSION_SECRET=e2e-local-session-secret-at-least-32-chars RAG_EMBEDDING_PROVIDER=deterministic LANGFUSE_ENABLED=false tsx e2e/api-server.ts`,
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
    {
      command: `NODE_ENV=development PORT=${webPort} WEB_PUBLIC_API_URL=http://127.0.0.1:${apiPort} pnpm --filter @opspilot/web dev`,
      url: `http://127.0.0.1:${webPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
  ],
  globalSetup: "./e2e/global-setup.mjs",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  outputDir: "test-results/playwright",
});
