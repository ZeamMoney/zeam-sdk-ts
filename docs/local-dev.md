# Local development & testing

## Running against a local gateway

```bash
ZEAM_SDK_ALLOW_INSECURE=1 npx tsx examples/login-otp/main.ts
```

```ts
import { Client, customEnvironment } from "@zeammoney/sdk";

const client = new Client({
  environment: customEnvironment("http://localhost:8080"),
  insecureTransport: true,
  skipVersionCheck: true,
});
```

The combination of `insecureTransport: true` and
`ZEAM_SDK_ALLOW_INSECURE=1` is the only way to use a plain-HTTP URL;
the SDK prints a stderr warning on every client constructed this way.

## Unit tests

```bash
npm test
```

Tests colocate as `src/**/*.test.ts` under vitest. The fake-gateway
harness lives in [`test/fake/fake.ts`](../test/fake/fake.ts).

## Contract tests against staging

```bash
ZEAM_API_URL=https://api.staging.zeam.app \
ZEAM_CONTRACT_TESTS=1 \
ZEAM_CONTRACT_TOKEN=<bearer> \
npm run test:contract
```

Never run in default CI without explicit intent. The GitHub Actions
workflow `.github/workflows/contract-staging.yml` provides OIDC-
federated credentials for the staging sandbox.

## Writing a test with the fake gateway

```ts
import { FakeServer, writeEnvelope } from "../test/fake/fake.js";
import { Client, customEnvironment } from "@zeammoney/sdk";

const server = new FakeServer([
  {
    method: "GET",
    path: "/healthz",
    handler: (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, version: "0.1.0" }));
    },
  },
]);
await server.start();

process.env.ZEAM_SDK_ALLOW_INSECURE = "1";
const client = new Client({
  environment: customEnvironment(server.url),
  insecureTransport: true,
});
```
