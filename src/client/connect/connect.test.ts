import { describe, expect, it, vi } from "vitest";
import { ConnectClient } from "./index.js";
import type { Doer } from "../../client.js";
import { Session, Track } from "../../auth/index.js";

function fixture(data: unknown = { ok: true }) {
  const fetch = vi.fn(async (_req: Request): Promise<Response> => {
    return Response.json({ data, status: 200, message: "OK" });
  });
  const doer: Doer = {
    baseURL: new URL("https://example.invalid"),
    userAgent: "test",
    verboseErrors: false,
    timeoutMs: 30_000,
    fetch,
  };
  const session = new Session({
    track: Track.Connect,
    idToken: "test-connect-token",
    refreshToken: "test-refresh-token",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  });
  return { client: new ConnectClient(doer, "test-connect-secret"), fetch, session };
}

describe("ConnectClient.exec SSRF guard", () => {
  it.each([
    ["https://evil.invalid/path", "connect: exec path must not be absolute"],
    ["http://evil.invalid", "connect: exec path must not be absolute"],
    ["//evil.invalid", "connect: exec path must not be absolute"],
    ["..", "connect: exec path must not contain `..`"],
    ["some/../thing", "connect: exec path must not contain `..`"],
    ["a path", 'connect: exec path must match ^[a-zA-Z0-9/_-]+$, got "a path"'],
    ["", "connect: exec path is required"],
    [
      "provider?redirect=evil",
      'connect: exec path must match ^[a-zA-Z0-9/_-]+$, got "provider?redirect=evil"',
    ],
    ["provider/%2e%2e", 'connect: exec path must match ^[a-zA-Z0-9/_-]+$, got "provider/%2e%2e"'],
    ["provider\\path", 'connect: exec path must match ^[a-zA-Z0-9/_-]+$, got "provider\\\\path"'],
  ])("rejects %s before fetch", async (path, message) => {
    const { client, fetch, session } = fixture();
    await expect(client.exec(session, "GET", path)).rejects.toThrow(new Error(message));
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["provider_v1/route-2", "/provider_v1/route-2"])(
    "allows the valid path %s with Connect credentials",
    async (path) => {
      const { client, fetch, session } = fixture();
      const body = { reference: "test-reference" };
      const controller = new AbortController();

      await expect(client.exec(session, "POST", path, body, controller.signal)).resolves.toEqual({
        ok: true,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      const req = fetch.mock.calls[0]![0];
      expect(req.url).toBe("https://example.invalid/v1/connect-exec/provider_v1/route-2");
      expect(req.method).toBe("POST");
      expect(req.headers.get("Authorization")).toBe("Bearer test-connect-token");
      expect(req.headers.get("x-zeam-auth")).toBe("test-connect-secret");
      expect(await req.json()).toEqual(body);
      controller.abort();
      expect(req.signal.aborted).toBe(true);
    },
  );

  it("preserves a transport failure on an allowed path", async () => {
    const { client, fetch, session } = fixture();
    const failure = new Error("offline transport failure");
    fetch.mockRejectedValueOnce(failure);
    await expect(client.exec(session, "GET", "valid/path")).rejects.toBe(failure);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ConnectClient.queryConnectors validation", () => {
  it.each([
    [
      { countryISO: "zw", method: "MOBILE_MONEY" },
      'connect: countryISO must match ^[A-Z0-9_]+$, got "zw"',
    ],
    [
      { countryISO: "ZW", method: "mobile_money" },
      'connect: method must match ^[A-Z0-9_]+$, got "mobile_money"',
    ],
  ])("rejects invalid enums %j before fetch", async (input, message) => {
    const { client, fetch, session } = fixture();
    await expect(client.queryConnectors(session, input)).rejects.toThrow(new Error(message));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends valid enums and unwraps the connector list", async () => {
    const connectors = [{ id: "test-connector", method: "MOBILE_MONEY" }];
    const { client, fetch, session } = fixture({ connectors: { connectors } });
    const input = { countryISO: "ZW", method: "MOBILE_MONEY" };
    await expect(client.queryConnectors(session, input)).resolves.toEqual(connectors);
    expect(fetch).toHaveBeenCalledTimes(1);
    const req = fetch.mock.calls[0]![0];
    expect(req.url).toBe("https://example.invalid/v1/connect-query");
    expect(req.method).toBe("POST");
    expect(req.headers.get("Authorization")).toBe("Bearer test-connect-token");
    expect(req.headers.get("x-zeam-auth")).toBe("test-connect-secret");
    expect(await req.json()).toEqual(input);
  });
});
