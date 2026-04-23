# Versioning policy

SDK `vA.B.C` targets gateway `vA.B.≥0`. The SDK contract and the
gateway's `/v1/*` contract move together.

## Parity mechanisms

1. **Shared version axis** — cutting a gateway `A.B` cuts an SDK `A.B`
   in the same week.
2. **Compile-time pin** — `MIN_GATEWAY_VERSION` is set at release
   and verified against the SHA of the bundled `api/openapi.yaml`.
3. **Runtime handshake** — `Client.ping()` compares the gateway's
   `/healthz` `version` against `MIN_GATEWAY_VERSION` and throws
   `IncompatibleGatewayError` on mismatch.
4. **OpenAPI single source of truth** — the gateway owns
   `docs/openapi.yaml`; the SDK syncs it at release time.
5. **Automated sync + reciprocal contract gate** — a cross-repo
   `repository_dispatch` workflow opens an `api-sync/vX.Y.Z` PR in the
   SDK for every new gateway tag. The gateway repo runs the SDK's
   contract suite on every gateway PR.

## Compatibility rules

- Public API additions → minor bump.
- Public API removals or signature changes → major bump; a `release/vN`
  branch retains the previous major for ≥6 months.
- Deprecations remain available for at least one full minor cycle and
  carry a `@deprecated` JSDoc tag pointing at the replacement.
- `src/internal/**` and `src/transport/**` changes are **never**
  considered breaking.

## Upgrading

- Minor upgrades: `npm install @zeammoney/sdk@latest`; run your existing
  tests. Breaking changes at minor versions are a release-engineering
  bug — open an issue.
- Major upgrades: check the CHANGELOG's **Removed** / **Changed**
  sections and the matching migration guide linked from the release
  notes.
