# Zeam TypeScript SDK

The official TypeScript SDK for the Zeam Platform API Gateway.
Secure-by-default, opinionated, and kept in lockstep with the gateway
contract. Server-side only (Node 22+, Deno, Bun).

- **Install**: `npm install @zeammoney/sdk`
- **Quickstart**: [Getting Started](getting-started.md)
- **Common flows**: [Recipes](recipes.md)
- **Security posture**: [Security](security.md)
- **Source**: [ZeamMoney/zeam-sdk-ts](https://github.com/ZeamMoney/zeam-sdk-ts)

## What the SDK gives you

- Typed, 1:1 clients under `@zeammoney/sdk/client/*` for every gateway
  endpoint.
- **Recipes** — opinionated end-to-end workflows for the 80% happy path.
- Automatic authentication lifecycle management (acquisition,
  single-flight refresh, cross-track isolation, secure storage).
- A narrow wrapper over the Stellar SDK (partners don't import
  `@stellar/stellar-sdk` directly).
- Inbound webhook HMAC verification with replay protection.

## Server-side only

One-time credentials (`stellar.secret`, `connectSecret`, `apiKey.secret`,
`webhookSecret.secret`) must never reach a browser. The SDK is
distributed without a browser build and declares `engines.node >= 22`
in `package.json`.
