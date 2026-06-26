import { describe, expect, it } from "vitest";
import { createHealthResponse, getServiceName } from "./main.js";

describe("@opspilot/web", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/web");
  });

  it("returns a scaffold health payload", () => {
    expect(createHealthResponse()).toEqual({ service: "@opspilot/web", status: "scaffolded" });
  });
});
