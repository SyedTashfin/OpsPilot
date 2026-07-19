import { expect, test } from "@playwright/test";

const apiBase = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 4300}`;
const accessCode = "e2e-local-code";
const hiddenExpectedRootCause =
  "The rec-2026.06.1 deployment changed feature-store timeout/retry behavior, causing feature-store timeouts and retry amplification.";

function healthResponse(status: "healthy" | "degraded" | "unhealthy" | "unknown") {
  return {
    status,
    timestamp: new Date("2026-07-19T00:00:00.000Z").toISOString(),
    diagnosticCategory:
      status === "healthy"
        ? "ok"
        : status === "degraded"
          ? "dependency_degraded"
          : "dependency_unavailable",
    dependencies: {
      database: {
        state: status,
        diagnosticCategory: status === "healthy" ? "ok" : "dependency_degraded",
        latencyMs: status === "unknown" ? undefined : 12,
      },
      llm: { state: "unknown", diagnosticCategory: "not_configured" },
    },
  };
}

test("dashboard loads with real incidents and real health is not inferred from HTTP 200", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Investigation Dashboard" })).toBeVisible();
  await expect(page.getByText("Detected incidents")).toBeVisible();
  await expect(
    page.getByText("Recommendation latency spike after feature-store timeout deployment"),
  ).toBeVisible();
  await expect(page.getByText("Recommendation Service")).toBeVisible();
  await expect(page.locator('[data-health-state="database"]')).not.toHaveText("connected");
});

for (const state of ["healthy", "degraded", "unhealthy", "unknown"] as const) {
  test(`renders HTTP-200 ${state} health contract accurately`, async ({ page }) => {
    await page.route(`${apiBase}/api/health`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: healthResponse(state),
      });
    });
    await page.goto("/");
    await expect(page.locator('[data-health-state="api"]')).toHaveText(state);
    await expect(page.locator('[data-health-state="database"]')).toHaveText(state);
    if (state === "degraded") {
      await expect(page.locator('[data-health-state="api"]')).not.toHaveText("Ready");
      await expect(page.locator('[data-health-state="database"]')).not.toHaveText("connected");
    }
  });
}

test("unauthenticated API mutation is denied and forged origin is rejected", async ({
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "API origin/rate-limit coverage runs on desktop only.",
  );
  const denied = await request.post(`${apiBase}/api/demo/seed`, { data: {} });
  expect(denied.status()).toBe(401);
  const login = await request.post(`${apiBase}/api/auth/login`, {
    headers: { origin: "http://127.0.0.1:3300", "content-type": "application/json" },
    data: { accessCode },
  });
  expect(login.ok()).toBeTruthy();
  const csrf = (await login.json()).csrfToken as string;
  const forged = await request.post(`${apiBase}/api/demo/seed`, {
    headers: {
      origin: "https://evil.example",
      "x-opspilot-csrf": csrf,
      "content-type": "application/json",
    },
    data: {},
  });
  expect(forged.status()).toBe(403);
});

test("canceled authentication shows a safe retryable message", async ({ page }) => {
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Run investigation" }).click();
  await expect(page.getByText("Authentication is required", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(accessCode);
  await expect(page.getByRole("button", { name: "Run investigation" })).toBeEnabled();
});

test("wrong access code shows a safe retryable message without echoing the secret", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Wrong-code rate-limit coverage runs on desktop only.",
  );
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept("wrong-access-code"));
  await page.getByRole("button", { name: "Run investigation" }).click();
  await expect(page.getByText("Authentication is required", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("wrong-access-code");
  await expect(page.getByRole("button", { name: "Run investigation" })).toBeEnabled();
});

test("authenticated deterministic investigation persists, reloads in history, and deep links", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(hiddenExpectedRootCause);
  await expect(page.locator("body")).not.toContainText("Common root cause:");
  page.on("dialog", (dialog) => dialog.accept(accessCode));
  await page.getByRole("button", { name: "Run investigation" }).click();
  await expect(page.getByText("Structured investigation report")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("feature-store timeout", { exact: false })).toBeVisible();
  await expect(page.getByText("Workflow execution")).toBeVisible();
  await expect(page.getByText("Evidence panel")).toBeVisible();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.locator("[data-investigation-history-id]").first()).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(page.locator("[data-investigation-history-id]").first()).toBeVisible();
  await page.goto(url);
  await expect(page.getByText("Structured investigation report")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("suspectedRootCause");
  await expect(page.locator("body")).not.toContainText("raw prompt");
});

test("safe error state renders", async ({ page }) => {
  await page.goto("/?investigationId=00000000-0000-4000-8000-000000000000#investigation");
  await expect(
    page.getByText("failed", { exact: false }).or(page.getByText("not found", { exact: false })),
  ).toBeVisible();
});
