# Authentication

The gateway has two independent authentication tracks:

- **Business** — end-user OTP / Firebase. Used by `/v1/business/*`,
  `/v1/application/*`.
- **Connect** — per-application sign-in. Used by `/v1/connect-*`.

**Tokens are not interchangeable.** The SDK refuses to attach a Business
token to a Connect call (and vice versa) via the `Track` enum.

## Business OTP

```ts
import { loginOTP } from "@zeammoney/sdk/recipes";

const session = await loginOTP(client, {
  mobileNumber: "+27821234567",
  async askCode(hint) {
    // show the masked destination to the user, read the code.
    return askUser(hint.maskedDestination);
  },
});
```

Under the hood:

1. `POST /v1/public/auth/request-otp` → `{ requestId, maskedDestination, expiresAt }`
2. The partner-provided `askCode` callback collects the code.
3. `POST /v1/public/auth/verify-otp` → `{ idToken, refreshToken, expiresIn, customToken }`
4. The session is stored in the client's `tokenStore` (default:
   `MemoryStore`).

## Connect sign-in

```ts
import { connectLogin } from "@zeammoney/sdk/recipes";

const session = await connectLogin(client, {
  publicKey: appPublicKey,
  secret: vaultApplicationSecret,
});
```

Under the hood:

1. `POST /v1/public/auth-connect/sign-in` with `{ publicKey, secret }` → `{ idToken, refreshToken, expiresIn }`.
2. Persist the session.

## Refresh lifecycle

Refresh tokens are **single-use**. The SDK's `AutoRefresher` coalesces
concurrent callers into a single in-flight refresh per track. Rehydrate
the refresher on application start if you persist sessions across
restarts.

## Track isolation — enforced by the SDK

```ts
// ConnectClient requires a Track.Connect session; passing a
// Track.Business session throws WrongTrackError before any request
// is built.
const connect = new ConnectClient(client, connectSecret);
await connect.queryConnectors(businessSession, input); // WrongTrackError
```

## Session lifecycle

A `Session` is created by the auth flows and should be treated as a
short-lived credential container. Key rules:

- **`idToken`** is the JWT placed in `Authorization: Bearer` on every
  API request. Do not log it — use `session.fingerprint` for
  correlation instead (it is a truncated hash, not the token itself).
- **`refreshToken`** is single-use. Once exchanged it is invalidated
  upstream; the response always returns a fresh pair.
- **`erase()`** replaces both tokens with `""` and resets the track to
  `Track.Unknown`. Call this when discarding a session. JS cannot
  guarantee memory zeroisation on V8, but this removes the values from
  reachable references.
- **`update()`** replaces `idToken`, `refreshToken`, and `expiresAt`
  atomically in place. Used internally by `AutoRefresher` after a
  successful refresh.
- **`needsRefresh(now, thresholdMs)`** returns `true` when the token
  will expire within `thresholdMs` milliseconds. The default threshold
  in `AutoRefresher` is 5 minutes.

## Token stores

The `TokenStore` interface (`put`, `get`, `delete`, `close`) decouples
session persistence from the auth flows.

| Store | Status | Use case |
|---|---|---|
| `MemoryStore` | Default, always available | Containers, serverless, CLI one-shots |
| `KeyringStore` | Phase 3 stub — throws on `put` | Desktop CLIs (OS bindings not yet wired) |
| Custom implementation | Supported today | Cloud secret managers, HSMs |

**`MemoryStore` rules:**

- Stores at most one session per `Track`.
- `put()` with a new session for an existing track calls `erase()` on
  the old one before replacing it — leaked references can no longer
  read the old tokens.
- `delete()` erases the session and removes it from the map.
- `close()` erases every stored session and clears the map. Call this
  on process shutdown.
- Refuses `Track.Unknown` sessions — throws immediately.

## AutoRefresher

`AutoRefresher` wraps any `Refresher` (both `OTPFlow` and `SEP10Flow`
implement `Refresher`) and prevents thundering-herd refreshes.

**Rules:**

1. If the current session does not need a refresh (within the threshold)
   it is returned immediately — no network call is made.
2. If a refresh is needed and none is in flight, a new one is started
   and stored in an internal `Map<Track, Promise<Session>>`.
3. Concurrent callers for the same track attach to the same in-flight
   promise — exactly one network round-trip occurs regardless of how
   many callers pile up.
4. After acquiring the in-flight slot the session is re-checked; if a
   peer already refreshed it the new token is returned without another
   call.
5. The slot is cleared from the map in a `finally` block so a failed
   refresh does not permanently block future attempts.

```ts
const ar = new AutoRefresher(client.tokenStore, client.otp);

// All five calls resolve with the same refreshed session; refresh()
// is called exactly once even if the token is stale.
const sessions = await Promise.all([
  ar.ensure(Track.Business),
  ar.ensure(Track.Business),
  ar.ensure(Track.Business),
  ar.ensure(Track.Business),
  ar.ensure(Track.Business),
]);
```

## Token field names

The gateway auth responses use `idToken` (not `accessToken`). The SDK
maps this field explicitly in both `OTPFlow` and `SEP10Flow`. Passing
`accessToken` where `idToken` is expected will result in a `Kind.Auth`
error on the first API call — the refresh flow in particular is
sensitive to this since the id-token is used as the bearer credential,
not the refresh token.

## Testing auth flows

```bash
# Unit tests — Session, MemoryStore, AutoRefresher, KeyringStore,
# expiryFromExpiresIn (no network required)
npx vitest run src/auth/auth.test.ts

# Live OTP smoke test (interactive — reads OTP from stdin)
ZEAM_TEST_MOBILE=+27821234567 npx tsx test/otp-smoke.ts

# Live Connect sign-in smoke test (requires application public key + secret)
ZEAM_TEST_APP_PUBKEY=G... ZEAM_TEST_APP_SECRET=S... npx tsx test/connect/401-refresh-smoke.ts
```
