# zeam-sdk-ts

[![npm](https://img.shields.io/npm/v/@zeammoney/sdk)](https://www.npmjs.com/package/@zeammoney/sdk)
[![License](https://img.shields.io/github/license/ZeamMoney/zeam-sdk-ts)](./LICENSE)
[![Node](https://img.shields.io/node/v/@zeammoney/sdk)](https://nodejs.org)

Official TypeScript SDK for the **Zeam API Gateway**. Server-side only (Node.js 22+,
Deno, Bun). Typed clients, high-level recipes, and automatic auth lifecycle management.

## Features

- **Typed clients** — 1:1 wrappers for every `/v1/*` gateway endpoint
- **Recipes** — one-call workflows for OTP login, SEP-10 auth, connect payments, credential rotation
- **Two auth tracks** — Business (OTP/Firebase) and Connect (SEP-10), isolated at the type level
- **Secure by default** — memory-only token store, TLS 1.3, payload redaction, constant-time webhook verification
- **Observable** — OpenTelemetry hooks, structured events, `X-Request-Id` propagation
- **Versioned parity** — runtime handshake against `/healthz` fails fast on gateway mismatch

## Installation

```bash
npm install @zeammoney/sdk
```

## Quick Start

```ts
import { Client, Environment } from "@zeammoney/sdk";
import { loginOTP } from "@zeammoney/sdk/recipes";

const client = new Client({ environment: Environment.Production });

const session = await loginOTP(client, {
  mobileNumber: "+27821234567",
  askCode: async (hint) => {
    return prompt(`OTP sent to ${hint.maskedDestination}`)!;
  },
});
```

See [docs/getting-started.md](docs/getting-started.md) for a full walkthrough.

## Configuration

| Option | Default | Description |
|---|---|---|
| `Environment.Production` | `https://api-gateway.zeam.app` | Canonical API gateway |
| `customEnvironment(url)` | — | Local dev (e.g. `http://localhost:8080`) |
| `timeoutMs` | 30000 | Per-call deadline in ms |
| `verboseErrors` | `false` | Include upstream gateway messages in errors |
| `skipVersionCheck` | `false` | Disable `/healthz` handshake |

### Environment variables

```bash
ZEAM_API_BASE_URL=https://api-gateway.zeam.app
ZEAM_CLIENT_ID=your_stellar_public_key
ZEAM_CLIENT_SECRET=your_stellar_seed     # from your secret manager
ZEAM_API_KEY=your_api_key                # required for Connect endpoints
```

### Sandbox mode

Zeam does not provide a separate sandbox URL. All integrations — sandbox and
production — call the same `https://api-gateway.zeam.app` endpoint. Your
credentials and Zeam-side account configuration determine your access mode.
You do not change URLs to switch between sandbox and production.

## Error handling

```ts
import { ZeamError, Kind } from "@zeammoney/sdk";

try {
  const data = await client.raw().get("/v1/business/association/all");
} catch (err) {
  if (err instanceof ZeamError) {
    console.log(`code=${err.code} kind=${err.kind} status=${err.status}`);
    if (err.is(Kind.Transient)) {
      // safe to retry
    }
  }
}
```

## Security

Distributed publicly — read [SECURITY.md](SECURITY.md) for the threat model,
disclosure process, and operational patterns integrators must follow.

Never commit one-time credentials returned by `POST /v1/application`
(`stellar.secret`, `connectSecret`, `apiKey.secret`, `webhookSecret.secret`)
to source control. Use a cloud secret manager.

## Versioning

SDK `vA.B.C` targets gateway `vA.B.≥0`. See [docs/versioning.md](docs/versioning.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Clone to first passing test in under ten minutes.

## License

Apache-2.0 — see [LICENSE](LICENSE).
