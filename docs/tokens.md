# Token lifecycle

The SDK isolates token storage behind `TokenStore`, which has two
concrete implementations:

- `MemoryStore` (default) — in-memory, never persisted.
- `KeyringStore` (Phase 3 v1 ship) — wraps the OS keychain (macOS
  Keychain, Windows DPAPI, Linux libsecret).

## Choosing a store

- **Short-lived workloads** (containers, serverless, CLI one-shots):
  use `MemoryStore`. Let the user re-authenticate on each cold start.
- **Long-lived daemons** writing to a cloud secret manager: implement
  the four-method `TokenStore` interface and pass it via
  `new Client({ tokenStore })`.
- **Desktop CLI tools**: `KeyringStore` once the Phase 3 OS bindings
  ship.

!!! warning "Never persist tokens to disk in plaintext"
TypeScript has no robust in-memory zeroisation on V8 (strings are
immutable and may be copied by the runtime). The SDK still replaces
token values with empty strings when a session is rotated or erased,
which protects against lingering references but not against memory
snapshots. Treat the host process memory as sensitive.

## Refresh semantics

- Every auth response is a new pair `{idToken, refreshToken}`. The old
  refresh token is **single-use** and invalidated upstream.
- `AutoRefresher` triggers refresh when the current id-token is within
  five minutes of expiry (configurable).
- Concurrent callers coalesce through a shared in-flight Promise; a
  thundering herd results in exactly one refresh round-trip.
- If refresh fails with `Kind.Auth`, call the appropriate login recipe
  again (`loginOTP` / `connectLogin`).

## Cross-track guard

`Session` carries a `Track` enum. `client/*` sub-packages refuse
sessions of the wrong track with `WrongTrackError` before any request
is built.
