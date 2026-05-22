# @zeammoney/sdk

[![npm](https://img.shields.io/badge/npm-v0.1.0-CB3837?logo=npm)](https://www.npmjs.com/package/@zeammoney/sdk)
[![License](https://img.shields.io/github/license/ZeamMoney/zeam-sdk-ts)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js)](https://nodejs.org)

Official TypeScript SDK for the Zeam API Gateway. Server-side only — Node.js 22+, Deno, and Bun are supported.

---

## Table of Contents

- [Installation](#installation)
- [Creating a Client](#creating-a-client)
- [Authentication](#authentication)
  - [Business Track — OTP](#business-track--otp)
  - [Connect Track — SEP-10](#connect-track--sep-10)
  - [Auto-refresh](#auto-refresh)
- [Business Client](#business-client)
  - [Associations](#associations)
  - [Wallets](#wallets)
  - [Assets](#assets)
  - [Beneficiaries](#beneficiaries)
- [Application Client](#application-client)
  - [Registering an Application](#registering-an-application)
  - [Lifecycle Transitions](#lifecycle-transitions)
  - [Webhooks](#webhooks)
  - [Credential Rotation](#credential-rotation)
- [Connect Client](#connect-client)
  - [Countries and Assets](#countries-and-assets)
  - [Connectors](#connectors)
  - [Quotes](#quotes)
  - [On-Ramp](#on-ramp)
  - [Off-Ramp](#off-ramp)
  - [Transaction Status](#transaction-status)
  - [Integrator](#integrator)
- [Health Client](#health-client)
- [Recipes](#recipes)
  - [loginOTP](#loginotp)
  - [connectLogin](#connectlogin)
  - [registerApplication](#registerapplication)
  - [rotateCredential](#rotatecredential)
  - [quoteThenExecute](#quotethenexecute)
  - [ConnectPayment](#connectpayment)
- [Webhook Verification](#webhook-verification)
- [Error Handling](#error-handling)
- [Advanced Configuration](#advanced-configuration)

---

## Installation

```bash
npm install @zeammoney/sdk
```

---

## Creating a Client

Everything starts with a single `Client` instance. Create one per process and reuse it.

```ts
import { Client, Environment } from "@zeammoney/sdk";

// Production (default)
const client = new Client();

// Explicit production
const client = new Client({ environment: Environment.Production });

// Custom URL — for local development or staging
const client = new Client({
  environment: Environment.custom("https://your-staging-gateway.com"),
});
```

### Sandbox mode

Zeam does not have a separate sandbox URL. Sandbox vs. production is determined by your **credentials and account configuration** on the Zeam side — both environments call the same `https://api-gateway.zeam.app` endpoint.

### Client options

| Option             | Default                    | Description                                                                          |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------ |
| `environment`      | `Environment.Production`   | Target gateway URL                                                                   |
| `timeoutMs`        | `30000`                    | Per-call deadline in ms                                                              |
| `verboseErrors`    | `false`                    | Include gateway's human-readable message in `ZeamError`                              |
| `skipVersionCheck` | `false`                    | Disable the `/healthz` version handshake on first call                               |
| `tokenStore`       | `MemoryStore`              | Where sessions are persisted (see [Advanced Configuration](#advanced-configuration)) |
| `refresher`        | `undefined`                | Enables automatic 401 retry (see [Auto-refresh](#auto-refresh))                      |
| `observer`         | `undefined`                | Observability hook for structured HTTP events                                        |
| `userAgent`        | `@zeammoney/sdk/<version>` | Override the User-Agent header                                                       |
| `fetchImpl`        | `globalThis.fetch`         | Inject a custom fetch — useful for testing                                           |

---

## Authentication

The SDK has two isolated authentication tracks. You must use the correct session type with each client — passing a Connect session to a Business endpoint (or vice versa) throws a `WrongTrackError` at runtime.

| Track        | Who uses it                                               | How to authenticate            |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| **Business** | Business operators — wallets, beneficiaries, applications | OTP via mobile number          |
| **Connect**  | Application integrators — payments, quotes, off-ramp      | SEP-10 via application keypair |

### Business Track — OTP

```ts
// Step 1: request an OTP to be sent to the user's phone
const { requestId, maskedDestination } = await client.otp.requestOTP({
  mobileNumber: "+27821234567",
});

console.log(`OTP sent to ${maskedDestination}`);

// Step 2: verify the code the user provides
const session = await client.otp.verifyOTP({
  requestId,
  code: "123456",
});
// session.track === "business"
```

**Sign-up flow** (new users):

```ts
const { requestId } = await client.otp.requestSignUp({ mobileNumber: "+27821234567" });

const session = await client.otp.verifySignUp({ requestId, code: "123456" });
```

**Resend an OTP:**

```ts
await client.otp.resendOTP({ requestId });
```

The `loginOTP` [recipe](#loginotp) wraps both steps into a single call.

---

### Connect Track — SEP-10

Connect authentication uses your application's Stellar keypair (public key + secret). The `connectLogin` [recipe](#connectlogin) is the simplest entry point.

```ts
const session = await client.sep10.signIn("GAPPLICATION_PUBLIC_KEY", "SAPPLICATION_SECRET_SEED");
// session.track === "connect"
```

> **Security:** The secret is sent to the gateway for server-side signing. Store it in a secret manager — never hardcode it.

---

### Auto-refresh

Pass a `refresher` to the client and 401 responses will automatically refresh the session and retry the request once. Concurrent 401s coalesce into a single refresh.

```ts
import { Client } from "@zeammoney/sdk";

const client = new Client({
  refresher: client.otp, // OTPFlow implements Refresher for the Business track
});
```

For long-running processes that need to proactively refresh before expiry:

```ts
import { AutoRefresher, MemoryStore } from "@zeammoney/sdk/auth";

const store = new MemoryStore();
const refresher = new AutoRefresher(store, client.otp); // refreshes within 5 min of expiry

const session = await refresher.ensure("business");
```

---

## Business Client

Import from `@zeammoney/sdk/client/business` and pass your `client` instance.

```ts
import { BusinessClient } from "@zeammoney/sdk/client/business";

const business = new BusinessClient(client);
```

All methods require a **Business-track session** as the first argument.

---

### Associations

Associations are the top-level organisational unit under a business account.

```ts
// List all associations
const associations = await business.listAssociations(session);

// Get a single association
const association = await business.getAssociationById(session, "assoc-uuid");
```

---

### Wallets

```ts
// List all wallets across all associations
const wallets = await business.listAllWallets(session);

// List wallets for a specific association
const wallets = await business.listWalletsByAssociation(session, "assoc-uuid");

// Get a single wallet (full details)
const wallet = await business.getWalletById(session, "wallet-uuid");

// Get a wallet DTO (lighter view, includes associationName — good for display)
const dto = await business.getWalletDTOById(session, "wallet-uuid");

// List available wallet types (use the returned id as typeId when creating)
const types = await business.listWalletTypes(session);

// Create a wallet
const result = await business.createWallet(session, {
  walletName: "Payouts Wallet",
  typeId: "type-uuid",
  networkId: "network-uuid",
  associationId: "assoc-uuid", // optional
});
console.log(result.publicKey);

// Update a wallet
const updated = await business.updateWallet(session, "wallet-uuid", {
  walletName: "Renamed Wallet",
});

// Execute a Stellar payment from a wallet
const tx = await business.executeWalletTransaction(session, "wallet-uuid", {
  toPublicKey: "GDESTINATION_PUBLIC_KEY",
  fromAsset: "USDC:GABC...",
  amount: "10.00",
  memo: "Invoice #42",
});
console.log(tx.transactionHash);
```

---

### Assets

```ts
// Full asset details
const assets = await business.listAssets(session);
const asset = await business.getAssetById(session, "asset-uuid");

// Lightweight DTO view (includes image URLs — good for display)
const dtos = await business.listAssetDTOs(session);
const dto = await business.getAssetDTOById(session, "asset-uuid");
```

---

### Beneficiaries

Beneficiaries represent the people or businesses your application sends money to. Each beneficiary can have multiple payment destinations.

```ts
// List beneficiaries for an association
const { beneficiaries, total } = await business.listBeneficiaries(session, "assoc-uuid", {
  search: "John", // optional name/reference filter
  beneficiary_type: "Individual", // "Individual" | "Business"
  payment_method: "BANK", // filter by payment method
});

// Get a single beneficiary
const { beneficiary } = await business.getBeneficiary(session, "assoc-uuid", "ben-uuid");

// Create a beneficiary
const { beneficiary } = await business.createBeneficiary(session, "assoc-uuid", {
  beneficiary_type: "Individual",
  reference: "john-doe-001",
  individual: {
    first_name: "John",
    last_name: "Doe",
    mobile_number: "+27821234567",
  },
  payment_destinations: [
    {
      method: "BANK",
      is_primary: true,
      country_iso: "ZA",
      bank_name: "FNB",
      account_number: "123456789",
      account_name: "John Doe",
    },
  ],
});

// Update a beneficiary
const updated = await business.updateBeneficiary(session, "assoc-uuid", "ben-uuid", {
  reference: "new-reference",
});

// Delete a beneficiary
await business.deleteBeneficiary(session, "assoc-uuid", "ben-uuid");

// Bulk create
const result = await business.bulkCreateBeneficiaries(session, "assoc-uuid", [
  { beneficiary_type: "Individual", individual: { first_name: "Jane" } },
]);
console.log(result.success_count, result.failed_count);
```

**Payment destinations:**

```ts
// List payment destinations for a beneficiary
const { payment_destinations } = await business.listPaymentDestinations(
  session,
  "assoc-uuid",
  "ben-uuid",
  "BANK", // optional method filter
);

// Add a payment destination
const { payment_destination } = await business.addPaymentDestination(
  session,
  "assoc-uuid",
  "ben-uuid",
  { method: "MOMO", is_primary: false, country_iso: "GH", mobile_number: "+233..." },
);

// Set a destination as primary
await business.setPaymentDestinationPrimary(session, "assoc-uuid", "ben-uuid", "dest-uuid");

// Update a payment destination
await business.updatePaymentDestination(session, "assoc-uuid", "ben-uuid", "dest-uuid", {
  account_name: "Updated Name",
});

// Delete a payment destination
await business.deletePaymentDestination(session, "assoc-uuid", "ben-uuid", "dest-uuid");
```

**Tags:**

```ts
const { tags, suggested_tags } = await business.getBeneficiaryTags(
  session,
  "assoc-uuid",
  "ben-uuid",
);

await business.updateBeneficiaryTags(session, "assoc-uuid", "ben-uuid", ["vip", "recurring"]);
```

**Available connectors for a beneficiary:**

```ts
const { connectors } = await business.getAvailableConnectors(
  session,
  "assoc-uuid",
  "ben-uuid",
  "BANK",
);
```

---

## Application Client

Import from `@zeammoney/sdk/client/application`.

```ts
import { ApplicationClient } from "@zeammoney/sdk/client/application";

const app = new ApplicationClient(client);
```

All methods require a **Business-track session**.

---

### Registering an Application

> Use the `registerApplication` [recipe](#registerapplication) instead of calling `app.register()` directly — it handles the one-time secret capture and zeroing for you.

```ts
const applications = await app.listApplications(session, "assoc-uuid");

const application = await app.getApplication(session, "app-uuid");

const events = await app.getApplicationEvents(session, "app-uuid");

// Look up an application by its Stellar public key
const application = await app.lookup(session, "GAPPLICATION_PUBLIC_KEY");
```

---

### Lifecycle Transitions

Applications move through a defined status lifecycle: `draft → pending_approval → approved → active`. Suspension and revocation are available at any point.

```ts
await app.submit(session, "app-uuid");
await app.approve(session, "app-uuid");
await app.reject(session, "app-uuid", { reason: "Missing webhook URL" });
await app.suspend(session, "app-uuid", { reason: "Compliance review" });
await app.resume(session, "app-uuid");
await app.revoke(session, "app-uuid");
```

---

### Webhooks

```ts
// List webhooks for an application
const webhooks = await app.listWebhooks(session, "app-uuid");

// Add a webhook
const { webhook, secret } = await app.addWebhook(session, "app-uuid", {
  url: "https://your-server.com/webhooks",
  webhookMethod: "POST",
  authScheme: "hmac",
});
// secret.secret is shown once — store it securely

// Update a webhook
await app.updateWebhook(session, "app-uuid", "webhook-uuid", {
  url: "https://your-server.com/webhooks-v2",
});

// Rotate the webhook signing secret
const { secret } = await app.rotateWebhookSecret(session, "app-uuid", "webhook-uuid");

// Delete a webhook
await app.deleteWebhook(session, "app-uuid", "webhook-uuid");
```

---

### Credential Rotation

> Use the `rotateCredential` [recipe](#rotatecredential) to safely capture the new API key before zeroing it.

```ts
// Low-level — returns the new credential directly
const { keyId, secret, last4 } = await app.rotateCredential(session, "app-uuid");

// Smoke-test the current API key
const { success } = await app.tokenSmokeTest(session, "app-uuid");
```

---

## Connect Client

The Connect client handles payment routing, quotes, on-ramp, and off-ramp flows. It requires both a **Connect-track session** and the `connectSecret` captured during application registration.

```ts
import { ConnectClient } from "@zeammoney/sdk/client/connect";

const connect = new ConnectClient(client, "your-connect-secret");
```

---

### Countries and Assets

```ts
// List supported countries
const countries = await connect.listCountries(session);

// List supported assets
const assets = await connect.listConnectAssets(session);

// Get a specific asset
const asset = await connect.getConnectAsset(session, "asset-uuid");
```

---

### Connectors

Connectors are the payment rails (bank, mobile money, crypto, etc.) available for a given country and method.

```ts
const connectors = await connect.queryConnectors(session, {
  countryISO: "ZA",
  method: "BANK",
});
```

**Escape hatch for unlisted endpoints:**

```ts
// exec() routes through /v1/connect-exec/{path} — useful for metadata-driven calls
const result = await connect.exec(session, "POST", "some/provider/path", { key: "value" });
```

---

### Quotes

Quotes return a `402 Payment Required` response on success (this is intentional — the SDK handles it transparently).

```ts
// Standard quote
const quote = await connect.getQuote(session, {
  fromCountry: "ZA",
  toCountry: "GH",
  fromCurrency: "ZAR",
  toCurrency: "GHS",
  amount: "1000",
  direction: "Send",
  method: "Bank",
  transactionType: "C2C",
});

// Directional quote — Send or Receive
const quote = await connect.getDirectionalQuote(session, "Send", { ... });
```

---

### On-Ramp

```ts
const result = await connect.executeOnRamp(session, {
  connectorId: "connector-uuid",
  quoteId: "quote-uuid",
  sender: { ... },
  // ...
});
```

---

### Off-Ramp

```ts
// Gateway-rewritten offramp (preferred)
const result = await connect.execute(session, {
  connectorId: "connector-uuid",
  quoteId: "quote-uuid",
  // ...
});

// Direct offramp
const result = await connect.executeOffRamp(session, { ... });
```

---

### Transaction Status

```ts
const status = await connect.getConnectStatus(session, "transaction-uuid");
console.log(status.status); // "Successful" | "Failed" | "Pending" | ...
```

---

### Integrator

```ts
const integrator = await connect.getIntegrator(session);
console.log(integrator.integratorId);
```

---

## Health Client

Unauthenticated — no session required.

```ts
import { HealthClient } from "@zeammoney/sdk/client/health";

const health = new HealthClient(client);
const { ok, version, uptime_ms } = await health.get();
```

The `Client` also exposes `client.ping()` which runs the same check and throws `IncompatibleGatewayError` if the gateway version is too old. This runs automatically on the first API call unless `skipVersionCheck: true` is set.

---

## Recipes

Recipes are high-level, opinionated workflows that compose the lower-level clients. Import from `@zeammoney/sdk/recipes`.

---

### loginOTP

Combines `requestOTP` and `verifyOTP` into one call. Persists the session to `client.tokenStore`.

```ts
import { loginOTP } from "@zeammoney/sdk/recipes";

const session = await loginOTP(client, {
  mobileNumber: "+27821234567",
  askCode: async (hint) => {
    // hint.maskedDestination is the phone number with digits masked
    // hint.requestId is the OTP request ID
    return await yourUI.promptForOTP(`OTP sent to ${hint.maskedDestination}`);
  },
});
```

---

### connectLogin

Signs in via SEP-10 and persists the Connect-track session to `client.tokenStore`.

```ts
import { connectLogin } from "@zeammoney/sdk/recipes";

const session = await connectLogin(client, {
  publicKey: "GAPPLICATION_PUBLIC_KEY",
  secret: process.env.APPLICATION_SECRET!,
});
```

---

### registerApplication

Registers a new application and safely captures the one-time credentials. The `captureOneTimeSecrets` callback receives all secrets **once** — they are zeroed immediately after the callback returns.

```ts
import { registerApplication } from "@zeammoney/sdk/recipes";

const result = await registerApplication(client, {
  session, // Business-track session
  payload: {
    associationId: "assoc-uuid",
    applicationName: "My Payment App",
    webhookUrl: "https://your-server.com/webhooks",
    webhookMethod: "POST",
    environment: "production",
  },
  captureOneTimeSecrets: async (secrets) => {
    // Store ALL of these in your secret manager before returning.
    // They will never be shown again.
    await secretManager.store({
      stellarSeed: secrets.stellarSeed,
      stellarPublicKey: secrets.stellarPublicKey,
      connectSecret: secrets.connectSecret,
      apiKey: secrets.apiKey,
      webhookSecret: secrets.webhookSecret,
    });
  },
});

console.log(result.integratorId);
console.log(result.apiKeyLast4); // safe to log — last 4 chars only
```

> **Important:** If `captureOneTimeSecrets` throws, the credentials have been minted but not captured. You must immediately rotate them.

---

### rotateCredential

Rotates your application's API key and safely hands off the new secret.

```ts
import { rotateCredential } from "@zeammoney/sdk/recipes";

await rotateCredential(client, {
  session,
  applicationId: "app-uuid",
  captureNew: async ({ keyId, newSecret, last4 }) => {
    await secretManager.update("api-key", newSecret);
  },
});
```

---

### quoteThenExecute

Generic orchestrator for any quote → decision → execute workflow.

```ts
import { quoteThenExecute } from "@zeammoney/sdk/recipes";

const { quote, result } = await quoteThenExecute({
  input: { amount: "1000", currency: "ZAR" },
  quote: (input, signal) => connect.getQuote(session, { ...input }),
  execute: (quote, signal) => connect.execute(session, { quoteId: quote.id }),
  decide: (quote) => quote.rate > 0.95, // return false to skip execution
  quoteTimeoutMs: 10_000,
});

if (result === null) {
  console.log("Quote declined, execution skipped");
}
```

---

### ConnectPayment

The highest-level recipe — orchestrates a full 8-step Stellar-backed off-ramp payment end to end.

```ts
import { newConnectPayment } from "@zeammoney/sdk/recipes";

const payment = newConnectPayment(client, {
  businessSession, // Business-track session
  applicationSecret, // Stellar secret seed
  applicationPublicKey, // Stellar public key
  associationId,
  walletId,
  fundingAsset: "USDC:GABC...",
  beneficiaryId,
  method: "Bank",
  countryISO: "ZA",
  sendAmount: 1000,
  connectSecret,
});

const result = await payment.do();

console.log(result.connectTransactionId);
console.log(result.stellarTxHash);
console.log(result.connectStatus);
```

The steps are also exposed individually if you need to interleave UI updates:

```ts
const associations = await payment.listAssociations();
const wallets = await payment.listWallets();
const beneficiary = await payment.getBeneficiary();
const connectSession = await payment.signInConnect();
const connectors = await payment.discoverConnectors();
const connector = payment.selectConnector(); // sync — picks from discovered list
const quote = await payment.getConnectQuote();
const txHash = await payment.executeStellarTransaction();
const connectResult = await payment.executeConnectPayment();
```

---

## Webhook Verification

Verify incoming webhook requests using the `verify` function or the `handler` middleware.

```ts
import { verify, handler, LRU } from "@zeammoney/sdk/webhook";

const replayCache = new LRU(1024); // bounded LRU, evicts least-recently-seen event IDs
```

**Standalone verification:**

```ts
// In your request handler:
try {
  const body = await verify(request, process.env.WEBHOOK_SECRET!, {
    maxSkewMs: 5 * 60 * 1000, // default: 5 minutes
    replayCache,
  });
  const event = JSON.parse(body);
  // handle event...
} catch (err) {
  if (err instanceof WebhookError) {
    console.log(err.reason); // "missing_signature" | "bad_signature" | "stale_timestamp" | ...
  }
}
```

**Middleware handler (Fetch-compatible):**

```ts
import { handler } from "@zeammoney/sdk/webhook";

const webhookHandler = handler(
  async (req, body) => {
    const event = JSON.parse(body);
    await processEvent(event);
    return new Response("ok", { status: 200 });
  },
  process.env.WEBHOOK_SECRET!,
  { replayCache },
);

// Use with any Fetch-compatible server (Hono, Bun, Deno, etc.)
export { webhookHandler };
```

Verification checks:

- HMAC-SHA256 signature over `timestamp.body`
- Timestamp freshness within `maxSkewMs`
- Optional replay protection via `replayCache`
- 2MB body size cap

---

## Error Handling

All gateway errors throw `ZeamError`. Use `err.kind` to decide whether to retry.

```ts
import { ZeamError, Kind } from "@zeammoney/sdk";

try {
  const wallets = await business.listAllWallets(session);
} catch (err) {
  if (err instanceof ZeamError) {
    console.error(`[${err.requestId}] ${err.code} (${err.status})`);

    if (err.is(Kind.Transient)) {
      // 408, 429, 503, 504 — safe to retry with backoff
    }
    if (err.is(Kind.Auth)) {
      // 401 — session expired, re-authenticate
    }
    if (err.is(Kind.Validation)) {
      // 400, 422 — bad input
    }
  }
}
```

**Error kinds:**

| Kind         | HTTP Status   | Meaning                     |
| ------------ | ------------- | --------------------------- |
| `Validation` | 400, 422      | Bad request input           |
| `Auth`       | 401           | Session expired or invalid  |
| `Authz`      | 403           | Insufficient permissions    |
| `NotFound`   | 404           | Resource does not exist     |
| `Conflict`   | 409           | Duplicate or state conflict |
| `Transient`  | 408, 429, 5xx | Temporary — safe to retry   |
| `Remote`     | 5xx           | Gateway-side error          |
| `Unknown`    | anything else | Unexpected                  |

**Other errors:**

```ts
import { IncompatibleGatewayError, WrongTrackError } from "@zeammoney/sdk";

// Thrown by client.ping() if gateway is older than the minimum supported version
if (err instanceof IncompatibleGatewayError) {
  console.log(err.gatewayVersion, err.minVersion);
}

// Thrown if you pass a Connect session to a Business endpoint or vice versa
if (err instanceof WrongTrackError) {
  // Re-authenticate with the correct track
}
```

**Verbose error messages:**

By default, `ZeamError.message` only includes the error code and request ID. Enable `verboseErrors` to include the gateway's human-readable message — useful for debugging but not recommended in production logs.

```ts
const client = new Client({ verboseErrors: true });
```

---

## Advanced Configuration

### Custom token store

Sessions are stored in memory by default. Provide your own `TokenStore` to persist across restarts.

```ts
import type { TokenStore } from "@zeammoney/sdk/auth";
import type { Session, Track } from "@zeammoney/sdk/auth";

class RedisTokenStore implements TokenStore {
  async put(session: Session): Promise<void> {
    /* ... */
  }
  async get(track: Track): Promise<Session | undefined> {
    /* ... */
  }
  async delete(track: Track): Promise<void> {
    /* ... */
  }
  async close(): Promise<void> {
    /* ... */
  }
}

const client = new Client({ tokenStore: new RedisTokenStore() });
```

### Observability hook

Attach structured logging or OpenTelemetry spans to every HTTP call. Sensitive headers are redacted before the hook is called.

```ts
const client = new Client({
  observer: (event) => {
    // event.method, event.url, event.status, event.durationMs, event.requestId
    logger.info("zeam-sdk", event);
  },
});
```

### Local development with plain HTTP

Plain HTTP is blocked by default. To allow it (local dev only):

```ts
// Requires ZEAM_SDK_ALLOW_INSECURE=1 environment variable
const client = new Client({
  environment: Environment.custom("http://localhost:8080"),
  insecureTransport: true,
  skipVersionCheck: true,
});
```

### Raw HTTP escape hatch

For endpoints not yet wrapped by the typed clients:

```ts
const data = await client.raw().get("/v1/some/endpoint");
const result = await client.raw().post("/v1/some/endpoint", { key: "value" });
```

### AbortSignal / cancellation

Every method accepts an optional `AbortSignal` as the last argument.

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

const wallets = await business.listAllWallets(session, controller.signal);
```

---

## Security

Never commit one-time credentials to source control. The credentials returned during application registration (`stellarSeed`, `connectSecret`, `apiKey`, `webhookSecret`) are shown **once** — store them in a cloud secret manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, etc.) before returning from `captureOneTimeSecrets`.

See [SECURITY.md](SECURITY.md) for the full threat model and disclosure process.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).
