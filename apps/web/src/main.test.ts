import { describe, expect, it } from "vitest";
import { getHealthPayload, getServiceName } from "./main.js";

describe("@opspilot/web", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/web");
  });

  it("returns a healthy scaffold payload", () => {
    expect(getHealthPayload()).toMatchObject({
      service: "@opspilot/web",
      status: "ok",
    });
  });
});
