# Changelog

All notable changes to the Zeam TypeScript SDK are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

SDK version `vA.B.C` targets gateway version `vA.B.≥0`. See
[docs/versioning.md](docs/versioning.md) for the full parity policy.

## [Unreleased]

### Security

- Upgrade Vitest and its coverage provider to patched 4.1 releases and refresh
  vulnerable transitive development dependencies.
- Audit development dependencies as well as production dependencies in CI.
- Reject HTTP redirects to prevent credential forwarding.
- Enforce webhook body limits while streaming bytes and strictly validate HMAC
  encoding. Bind replay-cache keys to authenticated content, not unsigned event IDs.

## [0.1.1] — 2026-05-22

### Added

- Automatic 401 retry with single-flight session refresh — pass a `refresher` to `ClientOptions` and failed requests are transparently retried after re-authentication.
- Full JSDoc on all Business client methods (wallets, assets, associations, beneficiaries) so editors show inline docs on `.`.
- Rewrote README as a complete user-facing guide covering all clients, auth tracks, recipes, webhook verification, error handling, and advanced configuration.

### Changed

- All response types are now fully nullable to avoid breaking downstream consumers on missing fields.
- Removed the built-in Stellar keypair/signer wrapper (`src/stellar/`) — Stellar operations now go through the gateway directly, reducing the dependency surface.
- Removed `payments` and `reports` sub-clients — these endpoints are not yet available on the gateway.
- OTP flow expanded with `requestSignUp`, `verifySignUp`, and `resendOTP` methods.
- SEP-10 `signIn` simplified — Stellar signing is now handled server-side by the gateway.

### Fixed

- Lint and formatting errors blocking CI.
- Upgraded Vitest to v3 to resolve esbuild/vite CVEs.
- Fixed broken npm and Node.js badges in README.

## [0.1.0] — 2026-04-23

Initial public release. See [RELEASE_NOTES.md](RELEASE_NOTES.md) for
the full announcement.

### Added

- Initial scaffold: `Client`, options, canonical error kinds, environments.
- `src/transport/` with envelope unwrap, redaction, retry, and
  observability hooks.
- `src/auth/` with Business OTP and SEP-10 flows, `TokenStore`
  interface, `MemoryStore`, and single-flight autorefresh.
- `src/stellar/` narrow wrapper exposing `Keypair`, `Signer`, and `Asset`.
- `src/client/` sub-packages for health, business, application,
  connect, payments, and reports.
- `src/recipes/` package: `loginOTP`, `registerApplication`,
  `connectLogin`, `connectPayment` (9-step off-ramp),
  `rotateCredential`, and `quoteThenExecute`.
- `src/webhook/` package with HMAC verification, constant-time
  comparison, clock-skew bounds, and replay cache.
- Example programs under `examples/`.
- MkDocs documentation scaffold under `docs/`.

### Security

- Default `TokenStore` is memory-only; persistence requires an explicit
  insecure opt-in.
- Redactor strips bearer tokens, `x-zeam-auth`, `Set-Cookie`, JWTs, and
  Stellar seed / public key patterns before any user-supplied logger
  sees them.
- `client/connect.exec` rejects absolute URIs and restricts the path
  regex to guard against SSRF abuse.

[Unreleased]: https://github.com/ZeamMoney/zeam-sdk-ts/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/ZeamMoney/zeam-sdk-ts/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ZeamMoney/zeam-sdk-ts/releases/tag/v0.1.0
