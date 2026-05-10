# Getting Started

## Prerequisites

- Node.js 22+ (see `.nvmrc`).
- A Zeam platform account with issued credentials.

## Install

```bash
npm install @zeammoney/sdk
```

## Your first call

```ts
import { Client, Environment } from "@zeammoney/sdk";

const client = new Client({ environment: Environment.Production });
await client.ping(); // version handshake

import { HealthClient } from "@zeammoney/sdk/client/health";
const h = await new HealthClient(client).get();
console.log(`gateway version: ${h.version}`);
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `Environment.Production` | `https://api-gateway.zeam.app` | Canonical API gateway (production and sandbox) |
| `customEnvironment(url)` | — | Local development (e.g. `http://localhost:8080`) |

### Sandbox mode

Zeam does not provide a separate sandbox URL. Sandbox mode runs against the
same `https://api-gateway.zeam.app` endpoint. Your credentials and account
configuration determine your access mode — you do not change URLs to switch
between sandbox and production.

## Version compatibility

The SDK exports `MIN_GATEWAY_VERSION`. On the first call, `Client.ping()`
compares it against the gateway's `/healthz` `version` field and throws
`IncompatibleGatewayError` if the gateway is older. Opt out during early
development with `skipVersionCheck: true`.

## Next steps

- [Authentication](auth.md) — get a Business or Connect session.
- [Recipes](recipes.md) — full workflows in one call.
- [Error handling](errors.md) — canonical codes and matching patterns.
