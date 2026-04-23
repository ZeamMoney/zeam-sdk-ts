# zeam-sdk-ts

[![npm](https://img.shields.io/npm/v/@zeammoney/sdk)](https://www.npmjs.com/package/@zeammoney/sdk)
[![License](https://img.shields.io/github/license/ZeamMoney/zeam-sdk-ts)](./LICENSE)
[![Node](https://img.shields.io/node/v/@zeammoney/sdk)](https://nodejs.org)

Official TypeScript SDK for the **Zeam Platform API Gateway**. Secure-by-default,
opinionated, and kept in lockstep with the gateway contract.

**Server-side only**: Node.js 22+, Deno, Bun. No browser build — one-time
credentials (`stellar.secret`, `connectSecret`, `apiKey.secret`,
`webhookSecret.secret`) must never reach an end-user device.

The SDK gives partner and first-party integrators:

- Typed, 1:1 clients for every `/v1/*` gateway endpoint.
- High-level **recipes** for common end-to-end flows (OTP login, SEP-10 login,
  application registration, connect payment orchestration, credential rotation).
- Automatic authentication lifecycle management (acquisition, single-flight
  refresh, cross-track isolation, secure storage).
- A narrow wrapper over the Stellar SDK so partners never import
  `@stellar/stellar-sdk` directly.
- Inbound webhook HMAC verification with replay protection.

```ts
import { Client, Environment } from "@zeammoney/sdk";
import { loginOTP } from "@zeammoney/sdk/recipes";

const client = new Client({ environment: Environment.Production });

const session = await loginOTP(client, {
  mobileNumber: "+27821234567",
  askCode: async (hint) => {
    // partner-supplied UX returns the code the end user typed.
    return prompt(`OTP sent to ${hint.maskedDestination}`)!;
  },
});
```

## Install

```bash
npm install @zeammoney/sdk
```

See [docs/getting-started.md](docs/getting-started.md) for a full walkthrough.

## Features

- **Two authentication tracks** — Business (OTP/Firebase) and Connect (SEP-10)
  are isolated at the type level; the SDK refuses to send a Business token to a
  Connect endpoint or vice versa.
- **Recipes**:
  - `loginOTP` — Business OTP login.
  - `registerApplication` — one-time-secret capture at registration.
  - `connectLogin` — full SEP-10 flow using a stored Stellar seed.
  - `connectPayment` — 9-step off-ramp payment orchestration.
  - `rotateCredential` — API key / webhook secret rotation.
- **Secure by default** — memory-only token store, redaction before any
  user-supplied logger, TLS 1.3 minimum, constant-time webhook signature
  verification, SSRF guards on `connect.exec`.
- **Observable** — OpenTelemetry hooks, structured events, `X-Request-Id`
  propagation. No secrets ever reach spans or logs.
- **Versioned parity** — declares `MIN_GATEWAY_VERSION` and performs a
  runtime handshake against `/healthz` so a mismatched gateway fails fast.

## Security

Distributed publicly — read [SECURITY.md](SECURITY.md) for the threat model,
disclosure process, and operational patterns integrators must follow.

**Never** commit the one-time credentials returned by `POST /v1/application`
(`stellar.secret`, `connectSecret`, `apiKey.secret`, `webhookSecret.secret`)
to source control. Use a cloud secret manager.

## Versioning

SDK `vA.B.C` targets gateway `vA.B.≥0`. Breaking contract changes bump
`A` (gateway) and `A` (SDK) together. See [docs/versioning.md](docs/versioning.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The goal is to get a new contributor
from clone to first passing test in **under ten minutes**.

## License

Apache-2.0 — see [LICENSE](LICENSE).
