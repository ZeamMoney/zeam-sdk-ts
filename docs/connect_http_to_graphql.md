# Connect — HTTP to GraphQL Shape Reference

Every HTTP call the gateway makes to `connect.zeam.dotnet`.  
Use this to write matching Bruno requests and to verify gateway routes.

**Base URL (internal):** `http://connect-api.zeam:8080/api/v1`  
**GraphQL endpoint:** `http://connect-api.zeam:8080/graphql`

---

## REST endpoints

### GET /routes
```
← nothing
→ PaginatedResponseModel<RouteResponseDto>
{
  data: [{
    routeId:       Guid
    name:          string
    direction:     "OnRamp" | "OffRamp" | "P2P"
    method:        "Bank" | "Momo" | "Cash" | "Card" | "Wallet" | "Voucher" | "QR"
    subRampMethod: "None" | "BankEft" | "BankRtgs" | "BankRtc" | "BankSwift" | "BankInstant"
    methodProvider: { id, name, description?, imageUrl? }
    country:        { id, name, currencyIso, iso, iso3?, dialingCode, isActive, currencyPrecision }
    settlementAsset:{ id, assetCode, issuer, currency }
    limits:        [{ id, scope, type, duration, minValue, maxValue, currency }]
    fees:          [{ tier, fixedFeeCcy, fixedFeeAmount, variableFeeCurrency, variableFeeAmount,
                      minFeeCurrency, minFeeAmount, maxFeeCurrency, maxFeeAmount,
                      bracketFeeCurrency?, bracketFeeMinimumAmount, bracketFee, bracketFeeIncrement,
                      feeDeductedFromPayout, transactionType }]
    paymentProvider: { id, name, internalName, routes, accounts, isActive, created, updated }
    isActive:       boolean
    rateType:       "Fixed" | "Variable" | "Hybrid" | "Bracket"
    externalIdentifier: int
    supportedTransactionType: { c2c, c2b, b2c, b2b }
  }]
}
```

---

### GET /providers
```
← nothing
→ ListResponseModel<PaymentProviderResponseDto>
{
  data: [{
    id:           Guid
    name:         string
    internalName: "KotaniPay" | "OTT" | "EasyPay" | "Zapper" | "Omari" | "Onafriq" | "Thunes" | "Unknown" | "Investec" | "BankTech"
    routes:       Array<RouteResponseDto>
    accounts:     [{ id, description, account, accountType }]
    isActive:     boolean
    created:      DateTime
    updated:      DateTime
  }]
}
```

### GET /providers/:id
Same response shape — single item wrapped in `SingleResponseModel`.

---

### GET /countries
```
← nothing
→ ListResponseModel<CountryResponseDto>
{
  data: [{
    id:               Guid
    name:             string
    currencyIso:      string
    iso:              string   // ISO 3166-1 alpha-2
    iso3:             string?  // ISO 3166-1 alpha-3
    dialingCode:      string
    isActive:         boolean
    currencyPrecision: int
  }]
}
```

---

### GET /assets
```
← nothing
→ ListResponseModel<AssetResponseDto>
{
  data: [{
    id:        Guid
    assetCode: string   // e.g. "USDC", "ZARP"
    issuer:    string   // Stellar public key
    currency:  string   // e.g. "USD", "ZAR"
  }]
}
```

### GET /assets/:id
Same shape — single item wrapped in `SingleResponseModel`.

---

### POST /quote/send  ·  POST /quote/:direction
**direction:** `send` | `receive`  
Gateway alias `/v1/connect-quote` always calls `/quote/send`.  
Returns **HTTP 402 Payment Required** on success (gateway passes through).

```
← QuoteRequestDto
{
  connectorId:     Guid
  transactionType: "C2C" | "C2B" | "B2C" | "B2B"  // optional
  amount:          number
  qr: { rawCode: string }                           // optional
}

→ QuoteResponseDto  (HTTP 402)
{
  quoteId:         Guid
  connectorId:     Guid
  sendAmount:      number
  sendCurrency:    string
  receiveAmount:   number
  receiveCurrency: string
  direction:       "Send" | "Receive"
  rate:            number
  fee:             number
  feeCurrency:     string
  total:           number
  createdAt:       DateTime
  expiresAt:       DateTime
  transactionType: "C2C" | "C2B" | "B2C" | "B2B"
  fundingInstructions?: {
    network:            "Stellar"
    destinationAccount: string
    asset: { code: string; issuer: string }
    memoType:           "Id" | "Hash" | "Text" | "Muxed"
    memo:               string
  }
  metadata?: { data: object }
}
```

---

### POST /offramp
Used by both `/v1/connect-offramp` and `/v1/connect-execute`.

```
← OffRampRequestDto
{
  reference:        string
  quoteId:          Guid
  transactionHash:  string
  refundAccount:    { account: string }
  purpose?:         string
  sender?: {
    msisdn:                  string   // required
    firstName?:              string
    middlename?:             string
    lastname?:               string
    nationalityCc?:          string
    dob?:                    string
    countryOfBirth?:         string
    gender?:                 string
    address?:                string
    postalCode?:             string
    city?:                   string
    countryIsoCode?:         string
    email?:                  string
    idType?:                 string
    idCountryIsoCode?:       string
    idNumber?:               string
    idExpiryDate?:           string
    occupation?:             string
    provinceState?:          string
    beneficiaryRelationship?: string
    sourceOfFunds?:          string
  }
  businessSender?:     { /* business fields */ }
  beneficiary?:        { /* personal beneficiary fields */ }
  businessBeneficiary?:{ /* business beneficiary fields */ }
  mobileMoney?:        { msisdn?: string; accountNumber?: string }
  bank?: {
    accountNumber:       string
    branchCode?:         string
    accountName?:        string
    accountType?:        string
    swiftCode?:          string
    iban?:               string
    bankId?:             int
    // + 10 other regional fields (clabe, cbu, bik_code, sort_code, etc.)
  }
  voucher?:  { product: string }
  cash?:     { reference: string }
  qr?:       { amount: number; tip: number }
}

→ OffRampResponseDto
{
  status:            ConnectTransactionStatus
  transactionId:     Guid
  externalReference: string
  connectorId:       Guid
  createdAt:         DateTime
}
```

---

### POST /onramp

```
← OnRampRequestDto
{
  reference:         string
  quoteId:           Guid
  settlementAccount: { account: string }
  purpose?:          string
  sender?:           { /* same sender shape as offramp */ }
  beneficiary?:      { /* personal beneficiary fields */ }
  mobileMoney?:      { msisdn?: string; accountNumber?: string }
  bank?:             { /* bank shape as offramp */ }
}

→ OnRampResponseDto
{
  status:            ConnectTransactionStatus
  transactionId:     Guid
  externalReference: string
  routeId:           Guid
  createdAt:         DateTime
}
```

---

### POST /onramp/cash-in

```
← OnRampCashInRequestDto
{
  reference:  string
  routeId:    Guid
  minLimit:   number
  maxLimit:   number
  amount:     number
  purpose:    string
  sender: {
    firstName:        string
    middlename?:      string
    lastname:         string
    nationalityCc:    string
    dob:              string
    idType:           string
    idCountryIsoCode: string
    idNumber:         string
  }
  fundingDestination: {
    network:       string
    walletAddress: string
    asset: { code: string; issuer: string }
  }
}

→ OnRampCashInResponseDto
{
  reference:     string
  transactionId: Guid
  providerName:  string
  epReference:   string
  expiresAt:     DateTime
  status:        ConnectTransactionStatus
}
```

---

### GET /status/:transaction_id

```
← path param: transaction_id (Guid)
→ StatusResponseDto
{
  transactionId: Guid
  status:        ConnectTransactionStatus
  updated:       DateTime
}
```

---

### GET /integrator

```
← nothing
→ IntegratorResponseDto
{
  id:   Guid
  name: string
  settlementAccount: { id, description, account, accountType }
  webhooks:  [{ id, url }]
  limits:    [{ id, scope, type, duration, minValue, maxValue, currency }]
}
```

---

### GET /platform/health

```
← nothing
→ PlatformHealthResponseDto
{
  status:         string
  message:        string
  timestampUtc:   DateTime
  region:         string
  environment:    string
  version:        string
  uptimeSeconds:  number
  api: {
    latencyP95Ms:   number
    errorRate15m:   number
  }
  dependencies: [{
    name:           string
    type:           string
    status:         string
    latencyMs?:     number
    lastSuccessUtc?: string
    lastOutage?:    string
  }]
  platform: {
    maintenanceWindow?: { startUtc: DateTime; endUtc: DateTime }
    allowedOperations:  Record<string, string>
  }
}
```

---

## GraphQL endpoint  (`POST /graphql`)

The gateway builds both queries server-side — callers never write GraphQL.

### Query 1 — Connectors  (via `/v1/connect-query`)

Gateway input: `{ "countryISO": "ZA", "method": "MOMO" }`  
Direction is hardcoded to `OFF_RAMP`.

```graphql
query Connectors {
  connectors {
    connectors(country: ZA, method: MOMO, direction: OFF_RAMP) {
      id
      name
      acceptedAsset
      destinationAsset
      requiresQuote
      isActive
      method
      fees {
        fixedFeeCcy
        fixedFeeAmount
        variableFeeCurrency
        variableFeeAmount
        minFeeCurrency
        minFeeAmount
        maxFeeCurrency
        maxFeeAmount
        feeDeductedFromPayout
        tier
      }
      limits {
        id
        scope
        type
        duration
        minValue
        maxValue
        currency
      }
      execution {
        step
        name
        path
        method
        requestDefinition
        responseDefinition
        additionalInstructions
      }
    }
  }
}
```

Expected GraphQL response:
```json
{
  "data": {
    "connectors": {
      "connectors": [
        {
          "id": "...",
          "name": "...",
          "acceptedAsset": "ZARP:G...",
          "destinationAsset": "ZAR",
          "requiresQuote": true,
          "isActive": true,
          "method": "BANK",
          "fees": [...],
          "limits": [...],
          "execution": [
            { "step": 1, "name": "quote", "path": "/quote/send", "method": "POST", ... },
            { "step": 2, "name": "offramp", "path": "/offramp", "method": "POST", ... }
          ]
        }
      ]
    }
  }
}
```

---

### Query 2 — Nodes by country  (via `/v1/connect-nodes?country=ZA`)

Gateway input: `?country=ZA` query param.  
Page size hardcoded to 100.

```graphql
query NodesByCountry {
  nodes {
    all(jurisdiction: ZA, pageIndex: 1, pageSize: 100) {
      id
      name
      type
      availability
      friendlyName
      logoUrl
      integrationInstructions
      jurisdiction {
        id
        name
        iso
        iso3
        currencyIso
        dialingCode
        isActive
        currencyPrecision
      }
      accountDetails {
        id
        holderName
        identifier
        publicKey
        network
        asset { assetCode currency issuer }
      }
      supportedMethods { id name }
      supportedNetworks {
        network
        asset { assetCode currency issuer }
      }
      connectors { id connectorId direction }
    }
  }
}
```

Expected GraphQL response:
```json
{
  "data": {
    "nodes": {
      "all": [
        {
          "id": "...",
          "name": "...",
          "type": "Bank",
          "availability": "Online",
          "jurisdiction": { "iso": "ZA", ... },
          "accountDetails": { "publicKey": "G...", "network": "Stellar", ... },
          "supportedMethods": [{ "name": "BankTransfer" }],
          "connectors": [{ "connectorId": "...", "direction": "OffRamp" }]
        }
      ]
    }
  }
}
```

---

## Enum reference

| Enum | Values |
|------|--------|
| `PaymentDirection` | `OnRamp` `OffRamp` `P2P` |
| `RampMethod` | `Bank` `Momo` `Cash` `Card` `Wallet` `Voucher` `QR` |
| `SubRampMethod` | `None` `BankEft` `BankRtgs` `BankRtc` `BankSwift` `BankInstant` |
| `QuoteDirection` | `Send` `Receive` |
| `TransactionType` | `C2C` `C2B` `B2C` `B2B` |
| `ConnectTransactionStatus` | `Authorized` `Initiated` `Successful` `Failed` `Pending` `PendingAuthorization` `RefundPending` `RefundProcessing` `Refunded` `RefundFailed` `Processing` `PaymentPending` `PaymentProcessing` `PaymentFailed` `Unknown` `AuthorizedFailed` |
| `FundingNetwork` | `Stellar` |
| `MemoType` | `Id` `Hash` `Text` `Muxed` |
| `FeeTier` | `Tier1` `Tier2` `Tier3` |
| `NodeAvailability` | `Restricted` `Planned` `Development` `Testing` `Online` `Offline` `Major_Outage` `Service_Interruptions` `Closed` |
| `Network` | `Stellar` `Ethereum` `Base` `Fiat` `Undefined` |
