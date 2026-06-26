import { describe, expect, it } from "vitest";
import { createHeartbeat, getServiceName } from "./main.js";

describe("@opspilot/demo-service", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/demo-service");
  });

  it("returns a scaffold heartbeat", () => {
    expect(createHeartbeat()).toEqual({ service: "@opspilot/demo-service", status: "scaffolded" });
  });
});
