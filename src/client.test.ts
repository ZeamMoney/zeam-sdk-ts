import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Client,
  Environment,
  IncompatibleGatewayError,
  Kind,
  ZeamError,
  customEnvironment,
  kindFromStatus,
} from "./index.js";
import { FakeServer, writeEnvelope } from "../test/fake/fake.js";

describe("Client construction", () => {
  it("rejects plain http without insecureTransport", () => {
    expect(
      () =>
        new Client({
          environment: customEnvironment("http://localhost:8080"),
        }),
    ).toThrow(/insecureTransport/);
  });

  it("rejects unsupported URL schemes", () => {
    expect(
      () =>
        new Client({
          environment: customEnvironment("ftp://example.com"),
        }),
    ).toThrow(/unsupported URL scheme/);
  });

  it("accepts http when the env var is set and insecureTransport is true", () => {
    vi.stubEnv("ZEAM_SDK_ALLOW_INSECURE", "1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const c = new Client({
      environment: customEnvironment("http://localhost:8080"),
      insecureTransport: true,
      skipVersionCheck: true,
    });
    expect(c.baseURL.host).toBe("localhost:8080");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("kindFromStatus", () => {
  it.each([
    [400, Kind.Validation],
    [422, Kind.Validation],
    [401, Kind.Auth],
    [403, Kind.Authz],
    [404, Kind.NotFound],
    [409, Kind.Conflict],
    [408, Kind.Transient],
    [429, Kind.Transient],
    [503, Kind.Transient],
    [504, Kind.Transient],
    [500, Kind.Remote],
    [502, Kind.Remote],
    [200, Kind.Unknown],
  ])("status %d → %s", (status, want) => {
    expect(kindFromStatus(status)).toBe(want);
  });
});

describe("ZeamError.is", () => {
  it("matches by kind", () => {
    const err = new ZeamError({
      code: "invalid_token",
      kind: Kind.Auth,
      status: 401,
      requestId: "rid-1",
    });
    expect(err.is(Kind.Auth)).toBe(true);
    expect(err.is(Kind.Validation)).toBe(false);
  });
});

describe("Client end-to-end", () => {
  const server = new FakeServer([
    {
      method: "GET",
      path: "/v1/echo",
      handler: (_req, res) => writeEnvelope(res, "rid-echo", { hello: "world" }),
    },
    {
      method: "GET",
      path: "/healthz",
      handler: (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, status: "ok", uptime_ms: 1, version: "99.0.0" }));
      },
    },
    {
      method: "GET",
      path: "/healthz-old",
      handler: (_req, res) => {
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, status: "ok", uptime_ms: 1, version: "0.0.1" }));
      },
    },
  ]);

  beforeAll(async () => {
    vi.stubEnv("ZEAM_SDK_ALLOW_INSECURE", "1");
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    vi.unstubAllEnvs();
  });

  it("unwraps a SPEC §18 envelope via client.raw().get()", async () => {
    const client = new Client({
      environment: customEnvironment(server.url),
      insecureTransport: true,
      skipVersionCheck: true,
    });
    const result = await client.raw().get("/v1/echo");
    expect(result).toEqual({ hello: "world" });
  });

  it("Environment.Production is https", () => {
    expect(Environment.Production.baseURL.startsWith("https://")).toBe(true);
  });

  it("ping passes when version is newer than MIN_GATEWAY_VERSION", async () => {
    const client = new Client({
      environment: customEnvironment(server.url),
      insecureTransport: true,
    });
    await expect(client.ping()).resolves.toBeUndefined();
  });

  it("ping throws IncompatibleGatewayError against an old gateway", async () => {
    const oldServer = new FakeServer([
      {
        method: "GET",
        path: "/healthz",
        handler: (_req, res) => {
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, version: "0.0.1" }));
        },
      },
    ]);
    await oldServer.start();
    try {
      const client = new Client({
        environment: customEnvironment(oldServer.url),
        insecureTransport: true,
      });
      await expect(client.ping()).rejects.toBeInstanceOf(IncompatibleGatewayError);
    } finally {
      await oldServer.stop();
    }
  });
});
