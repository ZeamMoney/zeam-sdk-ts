# PaymentsClient — Not Yet Implemented

`PaymentsClient` (`src/client/payments/index.ts`) is **stubbed out**. All methods are commented and the class is non-functional. The corresponding gateway routes do not exist in `zeam-api-gateway.go`.

## Intended endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/payments` | Create a payment |
| `GET` | `/v1/payments` | List payments |
| `GET` | `/v1/payments/:id` | Get a single payment |
| `POST` | `/v1/quotes` | Create a quote |
| `POST` | `/v1/orders` | Create an order |
| `POST` | `/v1/orders/:id/cancel` | Cancel an order |

All routes require a Business-track session (Firebase auth).

## Why it's disabled

None of these routes are registered in the gateway router (`internal/transport/http/router.go`), declared in `contracts/gateway-routes.yaml`, or backed by an upstream service config. They were written speculatively and have no implementation to proxy to.

## Re-enabling

1. Identify the upstream service (likely `offramps.zeam.dotnet`, `transactions-v2.zeam.dotnet`, or a new service).
2. Add the upstream base URL to `internal/platform/config/config.go`.
3. Create a handler package under `internal/transport/http/payments/`.
4. Wire the routes onto the `firebaseProtected` group in `internal/transport/http/router.go`.
5. Add route definitions to `contracts/gateway-routes.yaml`.
6. Uncomment `src/client/payments/index.ts` and add tests.
