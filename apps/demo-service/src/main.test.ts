import { describe, expect, it } from "vitest";
import { getServiceName } from "./main.js";

describe("@opspilot/demo-service", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/demo-service");
  });
});
