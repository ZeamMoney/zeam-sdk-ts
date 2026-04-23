# Security

Summary of the SDK's security posture. The authoritative source is
[`SECURITY.md`](https://github.com/ZeamMoney/zeam-sdk-ts/blob/main/SECURITY.md)
at the repo root.

## Reporting a vulnerability

Email **security@zeam.app**. Do not open public issues.

## Defensive defaults

- **Server-side only** — no browser build. One-time credentials must
  never reach a browser.
- `MemoryStore` is the default token store; disk persistence requires
  an explicit opt-in and prints a warning.
- `fetch` is used against HTTPS by default; `http://` requires
  `insecureTransport: true` + `ZEAM_SDK_ALLOW_INSECURE=1`.
- `redact` strips bearer tokens, `x-zeam-auth`, `Set-Cookie`, JWTs,
  and Stellar seed / public key patterns **before** the observer hook
  sees any event.
- `ConnectClient.exec` validates the path against a strict regex and
  refuses absolute URIs.
- Webhook verification is constant-time (`timingSafeEqual`),
  clock-skew-bounded, and replay-protected via the LRU cache.
- Every mutation carries a generated `Idempotency-Key` that's reused on
  retries.
- Cross-track guards refuse Business↔Connect token reuse with
  `WrongTrackError`.

## Stability contract

- **Public** entry points: `@zeammoney/sdk`, `/auth`, `/stellar`,
  `/recipes`, `/webhook`, `/client/*`.
- **Private**: `src/internal/**` and `src/transport/**`. Changes here
  are never considered breaking under semver.

## Expectations of integrators

See [Operational patterns](operational.md):

- Store one-time credentials in a cloud secret manager or HSM.
- Keep clocks synced.
- Run as non-root with a read-only FS.
- Rotate credentials via `rotateCredential` on suspected compromise.
