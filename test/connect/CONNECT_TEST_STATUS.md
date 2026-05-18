# Connect Test Coverage Status

Last updated: 2026-05-15

## Test Files

| File | What it tests | Auth required |
|------|--------------|---------------|
| `api-connect-smoke.ts` | All gateway endpoints that return 200 | SEP-10 + x-zeam-auth |
| `connect-smoke.ts` | SDK `ConnectClient` methods (typed) | SEP-10 via SDK |
| `connect-localhost-smoke.ts` | Connect service directly (port-forward) | SEP-10 |
| `offramp-e2e.ts` | Full offramp: quote → Stellar payment → bank payout | SEP-10 + OTP (Business) |
| `list-wallets.ts` | Utility to list Business wallets | OTP |

## Passing Endpoints (covered in api-connect-smoke.ts)

| Endpoint | Gateway path | Status |
|----------|-------------|--------|
| Auth (SEP-10 sign-in) | `POST /v1/public/auth-connect/sign-in` | 200 |
| Countries | `GET /v1/connect-countries` | 200 |
| Assets (list) | `GET /v1/connect-assets` | 200 |
| Assets (by ID) | `GET /v1/connect-assets/:id` | 200 |
| GraphQL connectors | `POST /v1/connect-query` | 200 |
| Quote (default) | `POST /v1/connect-quote` | 402 (success) |
| Quote (Send) | `POST /v1/connect-quote/Send` | 402 (success) |
| Integrator | `GET /v1/connect-integrators` | 200 |

## E2E Tested (covered in offramp-e2e.ts)

| Step | What | Status |
|------|------|--------|
| Business auth (OTP) | Login to access wallets | ✅ |
| Find wallet | Locate ZARZ_ACCOUNT by name | ✅ |
| Connect auth (SEP-10) | Login for Connect endpoints | ✅ |
| Get quote | 1 ZARZ via South Africa Bank EFT | ✅ 402 with data |
| Stellar payment | Send ZARZ via Business wallet tx | ✅ on-chain confirmed |
| Execute offramp | POST /connect-offramp with tx hash + bank details | ✅ Pending |
| Poll status | GET /connect-status/:id | ✅ returns Pending→Successful |

## Blocked Endpoints — Connect Backend Bugs

### 1. Routes — `GET /v1/connect-routes`
- **Status:** Crashes the Connect pod
- **Error:** `InternalProviderName` enum has no `Yoyo` value, but a DB row references it
- **Fix needed:** Connect team must either add `Yoyo` to the C# `InternalProviderName` enum, or delete/update the stale DB row
- **SDK impact:** `listRoutes()` commented out in `src/client/connect/routes/index.ts`

### 2. Providers — `GET /v1/connect-providers`
- **Status:** 403
- **Error:** `Cannot convert string value 'Yoyo' from the database to any value in the mapped 'InternalProviderName' enum`
- **Fix needed:** Same as Routes — the Yoyo enum issue
- **SDK impact:** `listProviders()` / `getProvider()` will fail until fixed

### 3. Quote Receive — `POST /v1/connect-quote/Receive`
- **Status:** 500
- **Error:** `ArgumentOutOfRangeException: Specified argument was out of the range of valid values`
- **Fix needed:** Connect team must fix the quote engine for ON_RAMP direction with the Investec connector (`8b1d36e6-ac45-4d4e-a1eb-c4f8835e9824`)
- **SDK impact:** `getDirectionalQuote(session, "Receive", ...)` throws. Blocks all OnRamp testing.

### 4. OnRamp Cash-In — `POST /v1/connect-onramp/cash-in`
- **Status:** 403
- **Error:** `No service for type 'MediatR.IRequestHandler<OnRampCashInCommand<...>>'`
- **Fix needed:** Connect team must register the `OnRampCashInCommand` MediatR handler in the DI container
- **SDK impact:** `onRampCashIn()` will fail until fixed

### 5. Platform Health — `GET /v1/connect-platform/health`
- **Status:** 404 through gateway
- **Root cause:** Gateway proxies to `/platform/health` but Connect’s health endpoint is `/healthz` (at the root, no `/api/v1/` prefix)
- **Works via:** localhost port-forward at `GET /healthz` (tested in `connect-localhost-smoke.ts`)
- **Fix needed:** Gateway `PlatformHealth` handler should proxy to `/healthz` instead of `/platform/health`
- **Gateway code:** `internal/transport/http/connect/handler.go:145` — `h.proxy(c, http.MethodGet, "/platform/health")` should be changed to target `/healthz`

## Not Testable Without Real Money

| Endpoint | Why |
|----------|-----|
| `POST /v1/connect-offramp` | Requires real Stellar tx hash (tested in offramp-e2e.ts) |
| `POST /v1/connect-onramp` | Requires real fiat deposit to Investec (manual bank EFT) |
| `POST /v1/connect-execute` | Gateway alias for offramp — same requirement |
| `GET /v1/connect-status/:id` | Needs a real transaction ID from a ramp |

## No Connectors Available

| Direction | Country | Status |
|-----------|---------|--------|
| P2P | ZA | No connectors configured (GraphQL enum is `P_2_P`) |

## SDK Type Fixes Applied

Types in `src/client/connect/types.ts` were updated to match the C# contracts in `connect.zeam.dotnet`:

- `RefundDto` / `SettlementDto`: `publicKey` → `account`
- `BankDto`: added 14 missing fields (clabe, cbu, sort_code, etc.)
- `BusinessPersonDto` → split into `BusinessSenderDto` + `BusinessBeneficiaryDto` with full snake_case fields
- `VoucherDto`: `voucherCode` → `product`
- `CashDto`: `locationId` → `reference`
- `QRDto`: `rawCode` → `amount` + `tip`
- `FundingDestinationDto`: `{publicKey, memo}` → `{network, walletAddress, asset}`
- `OnRampSenderDto`: `nationalityCc` → `nationality_cc`
- Quote methods: added `passthroughStatuses: [402]` so SDK doesn't throw on Connect's success status

## Running the Tests

```bash
# Gateway smoke test (all 200s, no money)
ZEAM_STELLAR_SEED=S... \
ZEAM_STELLAR_PUBLIC_KEY=G... \
ZEAM_CONNECT_SECRET=<secret> \
npx tsx test/connect/api-connect-smoke.ts

# Full offramp E2E (costs 2 ZARZ ≈ R2)
WALLET_NAME='ZARZ_ACCOUNT' \
ZEAM_MOBILE='+27...' \
ZEAM_STELLAR_SEED=S... \
ZEAM_STELLAR_PUBLIC_KEY=G... \
ZEAM_CONNECT_SECRET=<secret> \
BANK_ACCOUNT_NUMBER=... \
BANK_BRANCH_CODE=... \
BANK_ACCOUNT_NAME='...' \
SENDER_FIRST_NAME=... \
SENDER_LAST_NAME=... \
SENDER_MSISDN=27... \
SENDER_ID_NUMBER=... \
npx tsx test/connect/offramp-e2e.ts
```
