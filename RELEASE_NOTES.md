# v0.1.0 — Initial public release
*2026-04-23*

The first public release of **@zeammoney/sdk** — the official TypeScript
SDK for the Zeam Platform API Gateway. Secure-by-default, opinionated,
and kept in lockstep with the gateway contract.

## Target gateway

- **Minimum gateway version**: `v0.1.0`
- Compatibility enforced via `Client.ping()` → `IncompatibleGatewayError`
  on mismatch, plus the compile-time `MIN_GATEWAY_VERSION` + `SPEC_HASH`
  constants.

## Runtime scope

- **Server-side only**: Node.js 22+, Deno, Bun.
- No browser build. One-time credentials (`stellar.secret`,
  `connectSecret`, `apiKey.secret`, `webhookSecret.secret`) MUST NOT
  reach an end-user device.
- Dual-published **ESM + CJS** via `tsup`. TypeScript declarations
  generated from source. Subpath exports for every public module.

## Installation

```bash
npm install @zeammoney/sdk
```

## Highlights

### Two-layer SDK design
- Low-level `client/*` sub-packages mirror the gateway's route groups
  1:1 with typed request / response contracts.
- High-level `recipes/` module composes multi-step workflows behind a
  single function call.

### Recipes shipped in v0.1.0
- `loginOTP` — Business OTP login (request → verify → persist).
- `registerApplication` — `POST /v1/application` with a
  `captureOneTimeSecrets` callback that zeros the in-memory copy
  immediately after the partner stores it.
- `connectLogin` — full SEP-10 flow using a stored Stellar seed.
- `ConnectPayment` — 9-step Connect off-ramp orchestration. Each step
  is individually callable; `do()` runs the full happy path.
- `rotateCredential` — API-key rotation with an overlap-aware
  callback.
- `quoteThenExecute<In, Q, R>` — generic "quote → execute" helper.

### Secure-by-default
- `MemoryStore` is the default `TokenStore`; disk persistence requires
  an explicit insecure opt-in with a startup warning.
- `redact` strips bearer tokens, `x-zeam-auth`, `Set-Cookie`, JWTs,
  Stellar seed / public-key patterns, and platform API keys **before**
  any user-supplied observer sees an event.
- `fetch` targets HTTPS by default; plain HTTP requires
  `insecureTransport: true` AND `ZEAM_SDK_ALLOW_INSECURE=1`.
- Webhook verification is constant-time (`timingSafeEqual`), clock-skew
  bounded, and replay-protected via a bundled LRU cache.
- Cross-track guards refuse Business↔Connect token reuse with
  `WrongTrackError` before any request is built.
- `Idempotency-Key` generated automatically on every mutation and
  reused across retries.
- `connect.exec` validates the path against a strict regex and refuses
  absolute URIs (SSRF guard).

### Stellar surface
- Narrow wrapper exposing `Keypair`, `Signer`, and `Asset` — the only
  module allowed to import `@stellar/stellar-sdk` once the upstream
  binding lands in Phase 1.
- `parseAsset` / `assetsEqual` implement the gateway's XLM/native
  normalisation and `CODE:ISSUER` validation so partners catch
  malformed inputs before the network call.

### Authentication lifecycle
- `OTPFlow` + `SEP10Flow` handle the two gateway tracks.
- `AutoRefresher` coalesces concurrent refreshes into a single
  in-flight Promise per track; single-use refresh-token rotation is
  handled automatically.
- `Session.erase()` zeros tokens on rotation or sign-out.

### Observability without leakage
- `observer` hook in `ClientOptions` receives pre-redacted events
  (`http.request` with method, host, path, status, latency, X-Request-Id).
- The observer is shielded from its own throws so instrumentation
  cannot break request processing.

### Error model
- `ZeamError` extends `Error` and carries `{ code, kind, status,
  requestId, upstreamMessage, details }`.
- `kindFromStatus` maps HTTP → canonical `Kind` per ADR 0003 amendment
  2026-04-22 (`Validation` / `Auth` / `Authz` / `NotFound` / `Conflict`
  / `Transient` / `Remote`).
- `err.is(Kind.Auth)` short-circuits common checks; `err.upstreamMessage`
  is only surfaced in `.message` when `verboseErrors: true`.

## Documentation

Shipped under `docs/` as a MkDocs site ready to publish to
`https://sdk.zeam.app`:

- Getting Started, Authentication, Recipes, Error handling, Token
  lifecycle, Versioning policy, Local development, Operational
  patterns, Security.
- ADR: [SDK-0001 Repo, versioning, and parity](docs/adr/sdk-0001-repo-and-versioning.md).

## CI/CD

- `ci.yml` — lint + format check + typecheck + unit tests + `npm audit`.
- `api-sync.yml` — cross-repo `repository_dispatch` syncing the gateway
  OpenAPI spec on every gateway tag.
- `release.yml` — `npm publish --provenance`, cosign signing, SLSA
  provenance on tag push.
- `contract-staging.yml` — GitHub OIDC → Azure AD → staging contract
  suite, manual dispatch only.

## Verification

```
npm run typecheck    # clean
npm run lint         # clean
npx prettier --check .  # clean
npm test             # 6 suites, 71 tests passing
npm run build        # ESM + CJS + d.ts / d.cts produced
```

## Known deferrals

Called out in code where relevant:

- **`@stellar/stellar-sdk` binding** — `stellar.signer` refuses empty
  or unsigned XDR with an explicit error until the upstream binding is
  wired in the Phase 1 follow-up.
- **`internal/wire` codegen** from the OpenAPI spec — infrastructure in
  place (`scripts/sync-spec.mjs` + the api-sync workflow); generator
  hook-up lands in Phase 1.
- **`KeyringStore`** — public API is stable; native OS bindings
  (macOS Keychain / Windows DPAPI / Linux libsecret) ship in Phase 3.
- **SLSA provenance / cosign signing** — workflows in place; require
  `NPM_TOKEN` and keyless OIDC provisioning in the GitHub repo
  environment before the first tagged release.
- **gRPC streams** — deferred to v1.1 as agreed in the plan.

## Upgrade path from nothing

This is the initial release; no migration notes apply. Future minor
bumps are additive under SemVer. See
[docs/versioning.md](docs/versioning.md) for the full policy.

## Acknowledgements

- Gateway team (`BeamMoney/zeam-api-gateway.go`) for the canonical
  error taxonomy (ADR 0003), upstream proxy pattern (ADR 0008), and
  the nine-step Connect off-ramp flow the `ConnectPayment` recipe
  mirrors.
- Built alongside the Go SDK (`ZeamMoney/zeam-sdk-go`) so both surfaces
  share the same parity contract.

---

Report vulnerabilities to **security@zeam.app**. Do not open public
issues for security problems. Full disclosure policy in
[SECURITY.md](SECURITY.md).
