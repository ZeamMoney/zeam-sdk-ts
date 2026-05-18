# ReportsClient — Not Yet Implemented

`ReportsClient` (`src/client/reports/index.ts`) is **stubbed out**. All methods are commented and the class is non-functional. The corresponding gateway routes do not exist in `zeam-api-gateway.go`.

## Intended endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/reports/api-usage?from=&to=` | API usage over a date range |
| `GET` | `/v1/reports/wallet-balance?wallet=` | Balance report for a wallet |
| `GET` | `/v1/market-prices/:pair?type=` | Market price for a pair (`mid`, `buy-a`, `buy-b`) |
| `GET` | `/v1/network/status` | Network/Stellar status |

All routes require a Business-track session (Firebase auth).

## Why it's disabled

None of these routes are registered in the gateway router (`internal/transport/http/router.go`), declared in `contracts/gateway-routes.yaml`, or backed by an upstream service config. They were written speculatively and have no implementation to proxy to.

## Re-enabling

1. Identify the upstream service for each group:
   - `/v1/reports/*` — likely `businessapi.zeam.go` or a dedicated reporting service.
   - `/v1/market-prices/*` — likely `businessapi.zeam.go` (which already has asset/wallet routes).
   - `/v1/network/status` — likely a Stellar/Horizon health proxy.
2. Add any new upstream base URLs to `internal/platform/config/config.go`.
3. Create handler(s) under `internal/transport/http/reports/` (or extend an existing handler).
4. Wire the routes onto the `firebaseProtected` group in `internal/transport/http/router.go`.
5. Add route definitions to `contracts/gateway-routes.yaml`.
6. Uncomment `src/client/reports/index.ts` and add tests.
