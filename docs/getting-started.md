# Getting Started

## Prerequisites

- Node.js 22+ (see `.nvmrc`).
- A Zeam platform account (sandbox is fine for first integration).

## Install

```bash
npm install @zeammoney/sdk
```

## Your first call

```ts
import { Client, Environment } from "@zeammoney/sdk";

const client = new Client({ environment: Environment.Sandbox });
await client.ping(); // version handshake

// TypeScript types flow through for every endpoint:
import { HealthClient } from "@zeammoney/sdk/client/health";
const h = await new HealthClient(client).get();
console.log(`gateway version: ${h.version}`);
```

## Environments

| Environment              | Base URL                       |
| ------------------------ | ------------------------------ |
| `Environment.Production` | `https://api.zeam.app`         |
| `Environment.Staging`    | `https://api.staging.zeam.app` |
| `Environment.Sandbox`    | `https://api.sandbox.zeam.app` |
| `customEnvironment(url)` | partner-supplied               |

## Version compatibility

The SDK exports `MIN_GATEWAY_VERSION`. On the first call, `Client.ping()`
compares it against the gateway's `/healthz` `version` field and throws
`IncompatibleGatewayError` if the gateway is older. Opt out during
sandbox development with `skipVersionCheck: true`.

## Next steps

- [Authentication](auth.md) — get a Business or Connect session.
- [Recipes](recipes.md) — full workflows in one call.
- [Error handling](errors.md) — canonical codes and matching patterns.
