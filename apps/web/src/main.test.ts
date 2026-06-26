import { describe, expect, it } from "vitest";
import { getServiceName } from "./main.js";

describe("@opspilot/web", () => {
  it("exposes its service name", () => {
    expect(getServiceName()).toBe("@opspilot/web");
  });
});
