import { describe, expect, it } from "vitest";
import { createDashboardHtml, resolveDashboardConfig } from "./dashboard.js";
import { createHealthResponse, getServiceName } from "./main.js";
import { clientScript } from "./static/app.js";
import { dashboardStyles } from "./static/styles.js";

describe("@opspilot/web", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/web");
  });

  it("returns a ready health payload", () => {
    expect(createHealthResponse()).toEqual({ service: "@opspilot/web", status: "ready" });
  });

  it("resolves dashboard configuration from environment", () => {
    expect(
      resolveDashboardConfig({
        WEB_PUBLIC_API_URL: "http://api.local",
        WEB_PUBLIC_LANGFUSE_URL: "http://langfuse.local",
      }),
    ).toEqual({
      apiBaseUrl: "http://api.local",
      langfuseBaseUrl: "http://langfuse.local",
    });
  });

  it("renders the production dashboard shell", () => {
    const html = createDashboardHtml({
      apiBaseUrl: "http://api.local",
      langfuseBaseUrl: "http://langfuse.local",
    });

    expect(html).toContain("AI Investigation Dashboard");
    expect(html).toContain("Incident list");
    expect(html).toContain("Tool timeline");
    expect(html).toContain("Evidence panel");
    expect(html).toContain("Langfuse integration");
    expect(html).toContain('"apiBaseUrl":"http://api.local"');
  });

  it("serves static dashboard assets with key UI hooks", () => {
    expect(dashboardStyles).toContain("--accent");
    expect(dashboardStyles).toContain("@media");
    expect(clientScript).toContain("/api/incidents");
    expect(clientScript).toContain("/api/llm/status");
    expect(clientScript).toContain("investigationId");
    expect(clientScript).toContain("Open in Langfuse");
  });
});
