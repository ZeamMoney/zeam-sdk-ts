# BusinessClient

Wraps all `/v1/business/*` gateway endpoints. Requires a Business-track session (OTP login).

```ts
import { Client, BusinessClient, Environment } from "@zeammoney/sdk";

const client = new Client({ environment: Environment.Production });
const biz = new BusinessClient(client);

const challenge = await client.otp.requestOTP({ mobileNumber: "+27821234567" });
const session = await client.otp.verifyOTP({ requestId: challenge.requestId, code });

const associations = await biz.listAssociations(session);
```

---

## Architecture

Methods sit flat on `BusinessClient` but are implemented in domain subfolders:

```
src/client/business/
  index.ts                 ← BusinessClient (assembles all methods)
  associations/index.ts    ← associationMethods()
  assets/index.ts          ← assetMethods()
  wallets/index.ts         ← walletMethods()
  beneficiaries/index.ts   ← beneficiaryMethods()
```

TypeScript interface merging gives full type safety on the flat API without duplicating signatures. All types are exported from `@zeammoney/sdk/client/business`.

---

## Associations

| Method                            | Endpoint                           |
| --------------------------------- | ---------------------------------- |
| `listAssociations(session)`       | `GET /v1/business/association/all` |
| `getAssociationById(session, id)` | `GET /v1/business/association/:id` |

Returns `Association[]` and `Association` respectively.

---

## Assets

| Method                         | Endpoint                         | Status       |
| ------------------------------ | -------------------------------- | ------------ |
| `listAssets(session)`          | `GET /v1/business/asset`         | ✅           |
| `getAssetById(session, id)`    | `GET /v1/business/asset/:id`     | ⚠️ See below |
| `listAssetDTOs(session)`       | `GET /v1/business/asset/dto`     | ✅           |
| `getAssetDTOById(session, id)` | `GET /v1/business/asset/dto/:id` | ❌ See below |

### Asset vs AssetDTO

`Asset` is the internal representation — fields: `id`, `assetName`, `symbol`, `contractAddress`, `issuerAddress`, `networkID`, `networkName`, `type`, `decimals`. No images.

`AssetDTO` is the UI-friendly version — fields: `assetID`, `name`, `symbol`, `imageUrl`, `networkImageUrl`. Uses a **different ID space** (`assetID` ≠ `id`).

### Known upstream issues

**`getAssetById`** — Some assets returned by `listAssets` have placeholder UUIDs (e.g. `bb2c3d4e-5f6a-789b-bbbb-ccddeeff0011`) that do not exist in the upstream Business API, returning 404. Real UUIDs resolve correctly. Data issue upstream, not in the gateway.

**`getAssetDTOById`** — Returns `500 downstream_error: Failed to fetch networks` for all IDs. The upstream Business API crashes during network enrichment when fetching a single DTO by ID. Do not use until resolved.

---

## Wallets

| Method                                               | Endpoint                                   |
| ---------------------------------------------------- | ------------------------------------------ |
| `listWalletsByAssociation(session, assocId)`         | `GET /v1/business/wallet/association/:id`  |
| `listAllWallets(session)`                            | `GET /v1/business/wallet/all`              |
| `listWalletTypes(session)`                           | `GET /v1/business/wallet/type`             |
| `getWalletById(session, id)`                         | `GET /v1/business/wallet/:id`              |
| `getWalletDTOById(session, id)`                      | `GET /v1/business/wallet/dto/:id`          |
| `createWallet(session, input)`                       | `POST /v1/business/wallet`                 |
| `updateWallet(session, id, input)`                   | `PUT /v1/business/wallet/:id`              |
| `executeWalletTransaction(session, walletId, input)` | `POST /v1/business/wallet/:id/transaction` |

**`createWallet`** returns `{ id, publicKey, vaultId }` — not the full `Wallet` object.

**`executeWalletTransaction`** returns the full transaction record:

```ts
{
  (id,
    identityId,
    publicKey,
    transactionHash,
    transactionXdr,
    resultXdr,
    transactionDescription,
    amount,
    asset,
    createdAt);
}
```

---

## Beneficiaries

| Method                                                     | Endpoint                                         | Returns                                    |
| ---------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `listBeneficiaries(session, assocId, params?)`             | `GET /v1/business/beneficiaries/:assocId`        | `{ beneficiaries: Beneficiary[], total? }` |
| `getBeneficiary(session, assocId, id)`                     | `GET /v1/business/beneficiaries/:assocId/:id`    | `{ beneficiary: Beneficiary }`             |
| `createBeneficiary(session, assocId, input)`               | `POST /v1/business/beneficiaries/:assocId`       | `{ beneficiary: Beneficiary }`             |
| `bulkCreateBeneficiaries(session, assocId, beneficiaries)` | `POST /v1/business/beneficiaries/:assocId/bulk`  | `BulkCreateResult`                         |
| `updateBeneficiary(session, assocId, id, input)`           | `PUT /v1/business/beneficiaries/:assocId/:id`    | `Beneficiary`                              |
| `deleteBeneficiary(session, assocId, id)`                  | `DELETE /v1/business/beneficiaries/:assocId/:id` | `{}`                                       |

`listBeneficiaries` accepts an optional `BeneficiaryListParams` for filtering:

```ts
{ search?: string; beneficiary_type?: BeneficiaryType; payment_method?: PaymentMethod }
```

### Beneficiary tags

| Method                                              | Endpoint                                           |
| --------------------------------------------------- | -------------------------------------------------- |
| `getBeneficiaryTags(session, assocId, id)`          | `GET /v1/business/beneficiaries/:assocId/:id/tags` |
| `updateBeneficiaryTags(session, assocId, id, tags)` | `PUT /v1/business/beneficiaries/:assocId/:id/tags` |

Returns `{ tags: string[], suggested_tags: string[] }`.

### Payment destinations

| Method                                                          | Endpoint                                     | Returns                                                 |
| --------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `listPaymentDestinations(session, assocId, id, method?)`        | `GET …/payment-destinations`                 | `{ payment_destinations: PaymentDestination[], total }` |
| `addPaymentDestination(session, assocId, id, input)`            | `POST …/payment-destinations`                | `{ payment_destination: PaymentDestination }`           |
| `updatePaymentDestination(session, assocId, id, destId, input)` | `PUT …/payment-destinations/:destId`         | `{ payment_destination: PaymentDestination }`           |
| `deletePaymentDestination(session, assocId, id, destId)`        | `DELETE …/payment-destinations/:destId`      | `{}`                                                    |
| `setPaymentDestinationPrimary(session, assocId, id, destId)`    | `PUT …/payment-destinations/:destId/primary` | `{}`                                                    |

### Connectors

| Method                                                    | Endpoint                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `getAvailableConnectors(session, assocId, benId, method)` | `GET /v1/business/beneficiaries/getAvailableConnectors/:assocId/:benId/:method` |

Returns `{ connectors: { connectors: Connector[] } }`. `method` is a `PaymentMethod` value e.g. `"MOMO"`.

---

## Key types

```ts
type PaymentMethod = "BANK" | "MOMO" | "CRYPTO" | "CARD" | "CASH" | "QR" | "VOUCHER" | "WALLET";
type BeneficiaryType = "Individual" | "Business";
```

All types are re-exported from the barrel — import from `@zeammoney/sdk/client/business`.
