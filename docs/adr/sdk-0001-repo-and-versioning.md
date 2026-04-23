# SDK-0001 — Repo, versioning, and parity (TypeScript)

- Status: Accepted
- Date: 2026-04-23
- Phase: SDK v1 scaffold

## Context

The TypeScript SDK sits alongside the Go SDK (`zeam-sdk-go`) as a
parallel partner integration surface. Partners writing Node.js, Deno,
or Bun integrations need the same opinionated, secure-by-default
library the Go SDK provides, expressed in idiomatic TypeScript.

## Decision

### Repo strategy

- Gateway: `github.com/BeamMoney/zeam-api-gateway.go` (private).
- Go SDK: `github.com/ZeamMoney/zeam-sdk-go` (public).
- **TS SDK: `github.com/ZeamMoney/zeam-sdk-ts`** (public,
  Apache-2.0, published to npm as `@zeammoney/sdk`).

### Runtime scope

- **Server-side only**: Node 22+, Deno, Bun. No browser build, no CDN
  distribution. One-time credentials must never reach an end-user
  device.
- `package.json` declares `engines.node >= 22`.

### Module format

- ESM-first, dual-published ESM+CJS via `tsup`.
- Type declarations generated from TypeScript source; no hand-written
  `.d.ts`.
- Subpath exports for every public module (`/auth`, `/stellar`,
  `/recipes`, `/webhook`, `/client/*`).

### Versioning

- SemVer. SDK `vA.B.C` targets gateway `vA.B.≥0` — same policy as the
  Go SDK.
- `MIN_GATEWAY_VERSION` encoded in `src/version.ts` and verified at
  build time against the SHA of the bundled OpenAPI spec.
- Runtime handshake via `Client.ping()` → `IncompatibleGatewayError`
  on mismatch.

### Parity mechanisms

Identical to the Go SDK:

1. Shared version axis.
2. Compile-time pin on `MIN_GATEWAY_VERSION` + spec SHA.
3. Runtime handshake via `/healthz`.
4. OpenAPI single source of truth owned by the gateway.
5. Cross-repo `repository_dispatch` that opens an `api-sync/vX.Y.Z` PR
   for every new gateway tag; gateway CI runs the TS contract suite on
   every gateway PR and fails on drift.

### Release management

- Cut via `npm publish --provenance` on tag push.
- Each release publishes: source + d.ts, SLSA provenance, cosign-signed
  tags, docs rebuild to `sdk.zeam.app`.
- `CHANGELOG.md` is authoritative; GitHub Releases copy its body.

### Backward compatibility

- Additions → minor. Removals / signature changes → major.
- `src/internal/**` and `src/transport/**` are NEVER breaking.
- Public API diffs monitored via `attw` (are-the-types-wrong) and
  manual review during release.

### Distribution

- Apache-2.0.
- npm only — no standalone binary distribution since the package is a
  pure library.

## Consequences

- Partners targeting Node, Deno, or Bun have a canonical entry point.
- Parity with the Go SDK (and the gateway) is enforced by the same
  cross-repo contract gate.
- Browser integrations are deliberately out of scope; any future
  browser SDK would live in a separate repo with a separate threat
  model.

## Amendments

_Append dated entries when the pattern evolves._
