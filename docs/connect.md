# Connect Client

The Connect client handles cross-border payments via Zeam's Connect service — off-ramps (crypto → fiat), on-ramps (fiat → crypto), and P2P transfers.

## Authentication

Connect endpoints require **two** credentials:

1. **SEP-10 bearer token** — proves the caller controls a Stellar keypair. Obtained via `client.sep10.signIn(publicKey, secret)`.
2. **Connect secret** (`x-zeam-auth` header) — the integrator API key issued at application provisioning.

```typescript
import { Client, Environment } from "@zeammoney/sdk";
import { ConnectClient } from "@zeammoney/sdk/client/connect";

const client = new Client({ environment: Environment.Production });
const session = await client.sep10.signIn(publicKey, secret);
const connect = new ConnectClient(client, connectSecret);
```

The Stellar keypair is used **only for identity** — it does not need to be funded on-chain. Actual payments go through Business API managed wallets or any funded Stellar account.

## Connector Discovery

Connectors are discovered via GraphQL. The gateway owns the query shape — you just provide filters:

```typescript
const connectors = await connect.queryConnectors(session, {
  countryISO: "ZA",
  method: "BANK",
});
// Returns OFF_RAMP connectors for South Africa bank transfers
```

Valid filter values:
- **country**: ISO-2 code (`ZA`, `KE`, `NG`, etc.)
- **method**: `BANK`, `MOMO`, `CASH`, `CARD`, `WALLET`, `VOUCHER`, `QR`
- **direction** (via gateway): pinned to `OFF_RAMP` for `connect-query`; use direct GraphQL for `ON_RAMP` or `P_2_P`

## Quotes

Quotes return **HTTP 402** with the quote data — this is the documented success status ("here's your quote, now pay"). The SDK handles this transparently:

```typescript
const quote = await connect.getQuote(session, {
  connectorId: "1d7fca35-...",
  amount: 100,
});
// quote.quoteId, quote.total, quote.fundingInstructions, etc.

// Or with explicit direction:
const quote = await connect.getDirectionalQuote(session, "Send", {
  connectorId: "1d7fca35-...",
  amount: 100,
});
```

The `fundingInstructions` in the response tell you where to send the Stellar payment:
- `destinationAccount` — the Connect clearing account (G...)
- `asset` — the token to send (e.g. ZARZ)
- `memo` + `memoType` — must be included in the Stellar transaction
- `total` — the exact amount to send (includes fees)

Quotes expire in ~2 minutes.

## Off-Ramp Flow (Crypto → Fiat)

1. **Get a quote** — `connect.getDirectionalQuote(session, "Send", ...)`
2. **Send Stellar payment** — transfer `quote.total` of the asset to the clearing account with the memo
3. **Execute off-ramp** — `connect.executeOffRamp(session, body)` with the tx hash
4. **Poll status** — `connect.getConnectStatus(session, transactionId)`

```typescript
// Step 1: Quote
const quote = await connect.getDirectionalQuote(session, "Send", {
  connectorId: connectorId,
  amount: 1,
});

// Step 2: Stellar payment (via Business API wallet)
const tx = await biz.executeWalletTransaction(bizSession, walletId, {
  toPublicKey: quote.fundingInstructions.destinationAccount,
  fromAsset: `${quote.fundingInstructions.asset.code}:${quote.fundingInstructions.asset.issuer}`,
  amount: String(quote.total),
  memo: quote.fundingInstructions.memo,
  memoType: quote.fundingInstructions.memoType,
});

// Step 3: Execute off-ramp
const result = await connect.executeOffRamp(session, {
  reference: "my-ref-001",
  quoteId: quote.quoteId,
  transactionHash: tx.transactionHash,
  refundAccount: { account: walletPublicKey },
  sender: { firstName: "...", lastname: "...", msisdn: "27...", ... },
  bank: { accountNumber: "...", branchCode: "...", accountName: "...", accountType: "Savings" },
});

// Step 4: Poll
const status = await connect.getConnectStatus(session, result.transactionId);
// status.status: "Pending" → "Processing" → "Successful"
```

## On-Ramp Flow (Fiat → Crypto)

1. **Get a quote** — `connect.getDirectionalQuote(session, "Receive", ...)`
2. **Initiate on-ramp** — `connect.executeOnRamp(session, body)`
3. **User deposits fiat** — manual bank transfer to the provided account
4. **Connect detects deposit** — sends tokens to your settlement account
5. **Poll status** — `connect.getConnectStatus(session, transactionId)`

> **Note:** On-ramp quotes (`Receive` direction) currently return 500 for the Investec connector. This is a Connect backend bug — see test/connect/CONNECT_TEST_STATUS.md.

## Reference Data

```typescript
// Countries
const countries = await connect.listCountries(session);

// Assets
const assets = await connect.listConnectAssets(session);
const asset = await connect.getConnectAsset(session, assetId);

// Integrator info
const integrator = await connect.getIntegrator(session);
```

## Disabled Methods

The following methods are commented out due to Connect backend bugs. Types are still exported for forward compatibility:

| Method | Bug | Tracked in |
|--------|-----|------------|
| `listRoutes()` | Crashes Connect pod — `Yoyo` not in `InternalProviderName` enum | routes/index.ts |
| `listProviders()` / `getProvider()` | Same Yoyo enum bug — returns 403 | providers/index.ts |
| `onRampCashIn()` | MediatR handler not registered (DI bug) — returns 403 | onramp/index.ts |
| `getPlatformHealth()` | Gateway proxies to wrong path (`/platform/health` vs `/healthz`) | platform/index.ts |

## SDK Implementation Notes

### 402 Passthrough

Connect quotes return HTTP 402 as success. The SDK's `call()` and `unwrap()` functions accept a `passthroughStatuses` option so 402 is treated as success for quote methods only. This mirrors the gateway's `proxyWithPassthrough` pattern.

### Type Alignment

All request/response types in `src/client/connect/types.ts` are aligned with the C# contracts in `connect.zeam.dotnet/Connect.Zeam.Contracts`:

- `RefundDto` / `SettlementDto` use `account` (not `publicKey`)
- `BankDto` includes all 20+ fields from the C# contract
- `BusinessSenderDto` / `BusinessBeneficiaryDto` use snake_case field names matching `[JsonPropertyName]` attributes
- `FundingDestinationDto` includes `network`, `walletAddress`, and `asset`

### Module Structure

```
src/client/connect/
├── index.ts          # ConnectClient class composing all method groups
├── types.ts          # All DTOs aligned with C# contracts
├── assets/           # GET /v1/connect-assets
├── connectors/       # POST /v1/connect-query (GraphQL)
├── countries/        # GET /v1/connect-countries
├── integrator/       # GET /v1/connect-integrators
├── offramp/          # POST /v1/connect-offramp, /v1/connect-execute
├── onramp/           # POST /v1/connect-onramp
├── platform/         # GET /v1/connect-platform/health (disabled)
├── providers/        # GET /v1/connect-providers (disabled)
├── quotes/           # POST /v1/connect-quote (402 passthrough)
├── routes/           # GET /v1/connect-routes (disabled)
└── status/           # GET /v1/connect-status/:id
```

## Testing

See `test/connect/CONNECT_TEST_STATUS.md` for full coverage details.

```bash
# Smoke tests (free)
ZEAM_STELLAR_SEED=S... \
ZEAM_STELLAR_PUBLIC_KEY=G... \
ZEAM_CONNECT_SECRET=<secret> \
npx tsx test/connect/api-connect-smoke.ts   # Raw API
npx tsx test/connect/connect-smoke.ts       # SDK typed

# E2E off-ramp (costs 2 ZARZ ≈ R2 per run)
WALLET_NAME='ZARZ_ACCOUNT' \
ZEAM_TEST_MOBILE='+27...' \
# ... (see test/connect/offramp-e2e.ts for all env vars)
npx tsx test/connect/offramp-e2e.ts         # SDK
npx tsx test/connect/api-offramp-e2e.ts     # Raw API
```
