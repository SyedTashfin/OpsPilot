import { describe, expect, it } from "vitest";
import { createHealthResponse, getServiceName } from "./main.js";

describe("@opspilot/api", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/api");
  });

  it("returns a scaffold health payload", () => {
    expect(createHealthResponse()).toEqual({ service: "@opspilot/api", status: "scaffolded" });
  });
});
