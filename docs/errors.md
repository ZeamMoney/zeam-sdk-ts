# Error handling

Every SDK call that talks to the gateway throws either nothing or a
`ZeamError`. The error is mapped from the gateway's canonical error
envelope (ADR 0003 amendment 2026-04-22) and carries:

- `code` — stable, machine-readable reason code.
- `kind` — one of `Kind.Validation | Auth | Authz | NotFound |
Conflict | Transient | Remote | Unknown`.
- `status` — HTTP status code.
- `requestId` — gateway's `X-Request-Id`; surface to users for support.
- `upstreamMessage` — gateway's human-readable message. Only appended
  to `.message` when the Client was constructed with
  `verboseErrors: true`.
- `details` — structured upstream context.

## Matching patterns

```ts
import { Kind, ZeamError } from "@zeammoney/sdk";

try {
  await client.payments.createPayment(sess, body);
} catch (err) {
  if (err instanceof ZeamError) {
    if (err.is(Kind.Auth)) {
      // session expired or revoked; call connectLogin / loginOTP again.
    }
    if (err.code === "invalid_stellar_secret") {
      // rotate the seed.
    }
  }
  throw err;
}
```

## Surfacing to end users

Never surface `err.upstreamMessage` directly — it may be upstream copy
tuned for internal operators. Surface:

- The **canonical code** if you have UX that maps it.
- A short category-appropriate message plus `err.requestId`.

```ts
`Sorry — ${action} failed (ref ${err.requestId}).`;
```

## HTTP-status mapping

| Status             | `Kind`       |
| ------------------ | ------------ |
| 400, 422           | `Validation` |
| 401                | `Auth`       |
| 403                | `Authz`      |
| 404                | `NotFound`   |
| 409                | `Conflict`   |
| 408, 429, 503, 504 | `Transient`  |
| 5xx (other)        | `Remote`     |
