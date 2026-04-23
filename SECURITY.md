# Security Policy

The Zeam TypeScript SDK is a public, security-critical library. The team
treats security as a first-class design principle. This document captures:

1. The threat model the SDK is built against.
2. How to report a vulnerability.
3. What is and is not part of the stability contract.
4. Baseline expectations for integrators.

## Reporting a vulnerability

Email **security@zeam.app** with a description, reproduction, and impact.
Do **not** open public issues. The team will acknowledge within one
business day and target a fix within 30 days for high-severity issues.
We honour a 90-day coordinated-disclosure window by default.

Please include:

- SDK version (`VERSION` export).
- Minimum reproduction (TypeScript snippet + relevant gateway endpoint).
- Whether you need credentials redacted from the report.

Advisories: <https://github.com/ZeamMoney/zeam-sdk-ts/security/advisories>

## Threat model

Assets the SDK protects:

- **One-time application secrets** returned by `POST /v1/application`:
  `stellar.secret`, `connectSecret`, `apiKey.secret`, `webhookSecret.secret`.
- **Bearer tokens** issued by OTP or SEP-10.
- **OTP codes** delivered out-of-band to end users.
- Integrity of every inbound webhook payload.

Adversaries considered:

- Passive on-path attackers.
- Partners with write access to logs, tracing, or crash-reporting
  pipelines that may capture secrets inadvertently.
- Malicious partners attempting SSRF, replay, or cross-track reuse.
- Supply-chain attackers targeting npm dependencies or release
  artefacts.

## Defensive posture

| Control                      | Mechanism                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-only distribution** | No browser build; `package.json` declares Node 22 engine. Seeds and tokens must never reach browsers.                                                                                                    |
| Secret-in-memory only        | Default `TokenStore` is `MemoryStore`; disk persistence requires explicit `useInsecureFileStore: true` which prints a startup warning.                                                                   |
| Redaction                    | Request/response attributes pass through the redactor before any user-supplied logger / observer. Bearer tokens, `x-zeam-auth`, `Set-Cookie`, JWTs, and Stellar seed / public key patterns are stripped. |
| Transport                    | `fetch` used against HTTPS only by default; plain `http://` requires `insecureTransport: true` AND `ZEAM_SDK_ALLOW_INSECURE=1`.                                                                          |
| Replay protection            | `Idempotency-Key` generated for every mutation and reused across retries. Webhook verification includes a replay cache and clock-skew bound.                                                             |
| Cross-track guard            | `Session.track` enum; `client/connect/*` refuses Business tokens with `WrongTrackError`.                                                                                                                 |
| Race-safe refresh            | Token refresh uses a shared in-flight promise so concurrent callers coalesce.                                                                                                                            |
| SSRF guard                   | `connect.exec` validates the path against a restrictive regex and refuses absolute URIs.                                                                                                                 |
| Secure errors                | `ZeamError.message` surfaces only the canonical `code` + `requestId`; the upstream gateway message is only exposed when `verboseErrors: true`.                                                           |

## Stability contract

**Public** entry points:

- `@zeammoney/sdk` (top-level Client, options, errors, environment).
- `@zeammoney/sdk/auth`, `/stellar`, `/recipes`, `/webhook`.
- `@zeammoney/sdk/client/*` sub-packages.

Everything under `src/internal/**` and `src/transport/**` is **private**.
Depending on private paths is unsupported and changes there are
explicitly **not** considered breaking.

## Expectations of integrators

- Store one-time credentials in a cloud secret manager or HSM — never
  in committed `.env` files, logs, telemetry, or crash reports.
- Rotate credentials on suspicion of compromise via `rotateCredential`.
- Run with an accurate system clock (NTP / chrony) — SEP-10 signatures
  are time-bound.
- Allow-list gateway egress only; the SDK does not talk to any other
  host under `Environment.Production`.

See [docs/operational.md](docs/operational.md) for the full operational
recommendations.
