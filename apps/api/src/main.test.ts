import { describe, expect, it } from "vitest";
import { getHealthPayload, getServiceName } from "./main.js";

describe("@opspilot/api", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/api");
  });

  it("returns a healthy scaffold payload", () => {
    expect(getHealthPayload()).toMatchObject({
      service: "@opspilot/api",
      status: "ok",
    });
  });
});
