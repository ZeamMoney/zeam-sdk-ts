import { describe, expect, it } from "vitest";
import { ConnectClient } from "./index.js";
import type { Doer } from "../../client.js";

const fakeDoer: Doer = {
  baseURL: new URL("https://example.invalid"),
  userAgent: "test",
  verboseErrors: false,
  timeoutMs: 30_000,
  async fetch(): Promise<Response> {
    throw new Error("should not be reached");
  },
};

describe("ConnectClient.exec SSRF guard", () => {
  const c = new ConnectClient(fakeDoer, "not-used");

  it.each([
    "https://evil.com/path",
    "http://evil.com",
    "//evil.com",
    "..",
    "some/../thing",
    "a path",
    "",
  ])("rejects %s", async (p) => {
    await expect(c.exec(undefined as never, "GET", p)).rejects.toThrow();
  });
});

describe("ConnectClient.queryConnectors validation", () => {
  const c = new ConnectClient(fakeDoer, "x");
  it("rejects lowercase countryISO", async () => {
    await expect(
      c.queryConnectors(undefined as never, { countryISO: "zw", method: "MOBILE_MONEY" }),
    ).rejects.toThrow(/countryISO/);
  });
});
