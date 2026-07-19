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

  it("renders the production dashboard shell without server secrets", () => {
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
    expect(html).not.toMatch(
      /accessCode|sessionSecret|OPSPILOT_PORTFOLIO_ACCESS_CODE|OPSPILOT_SESSION_SECRET/i,
    );
    expect(clientScript).not.toMatch(
      /OPSPILOT_PORTFOLIO_ACCESS_CODE|OPSPILOT_SESSION_SECRET|demo-code|session-secret/i,
    );
  });

  it("serves static dashboard assets with key UI hooks", () => {
    expect(dashboardStyles).toContain("--accent");
    expect(dashboardStyles).toContain("@media");
    expect(clientScript).toContain("/api/incidents");
    expect(clientScript).toContain("/api/llm/status");
    expect(clientScript).toContain("investigationId");
    expect(clientScript).toContain("Open in Langfuse");
    expect(clientScript).toContain("/api/auth/session");
    expect(clientScript).toContain("clearClientAuth");
    expect(clientScript).toContain("Authentication is required");
    expect(clientScript).toContain("loadInvestigationHistory");
    expect(clientScript).toContain("Loading investigation history");
    expect(clientScript).toContain("No persisted investigations yet");
    expect(clientScript).toContain("Unable to load investigation history");
    expect(clientScript).toContain("data-investigation-history-id");
    expect(clientScript).toContain("?investigationId=");
    expect(clientScript).toContain("await loadInvestigationHistory({ reset: true })");
  });
});
