import { describe, expect, it } from "vitest";
import { getHealthPayload, getServiceName } from "./main.js";

describe("@opspilot/demo-service", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/demo-service");
  });

  it("returns a healthy scaffold payload", () => {
    expect(getHealthPayload()).toMatchObject({
      service: "@opspilot/demo-service",
      status: "ok",
    });
  });
});
