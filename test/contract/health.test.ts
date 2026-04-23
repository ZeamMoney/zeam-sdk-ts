// Live-gateway smoke tests. Invoked via `npm run test:contract` with
// `ZEAM_API_URL=...` and `ZEAM_CONTRACT_TESTS=1`. Never run in default
// CI without explicit intent.

import { describe, expect, it } from "vitest";
import { Client, customEnvironment } from "../../src/index.js";
import { HealthClient } from "../../src/client/health/index.js";

const enabled = process.env.ZEAM_CONTRACT_TESTS === "1";
const baseURL = process.env.ZEAM_API_URL;

describe.skipIf(!enabled || !baseURL)("contract: /healthz", () => {
  it("responds with a version field", async () => {
    const client = new Client({
      environment: customEnvironment(baseURL!),
      insecureTransport: baseURL!.startsWith("http://"),
      skipVersionCheck: true,
    });
    const health = new HealthClient(client);
    const body = await health.get();
    expect(body.version).toBeTruthy();
  });
});
