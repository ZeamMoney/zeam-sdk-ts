# Authentication

The gateway has two independent authentication tracks:

- **Business** — end-user OTP / Firebase. Used by `/v1/business/*`,
  `/v1/application/*`, `/v1/payments`, `/v1/reports/*`.
- **Connect** — per-application SEP-10. Used by `/v1/connect-*`.

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

## Connect SEP-10

```ts
import { connectLogin } from "@zeammoney/sdk/recipes";

const session = await connectLogin(client, {
  stellarSeed: vaultStellarSeed,
  publicKey: appPublicKey,
});
```

Under the hood:

1. `GET /auth-connect?account=<publicKey>` → challenge XDR.
2. Sign the challenge locally with the seed (the seed never leaves the
   caller's process).
3. `POST /auth-connect` with the signed XDR → `{ idToken, refreshToken, expiresIn }`.
4. Persist the session.

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
