// ── Enums ─────────────────────────────────────────────────────────────────────

export type PaymentDirection = "OnRamp" | "OffRamp" | "P2P";
export type RampMethod = "Bank" | "Momo" | "Cash" | "Card" | "Wallet" | "Voucher" | "QR";
export type SubRampMethod =
  | "None"
  | "BankEft"
  | "BankRtgs"
  | "BankRtc"
  | "BankSwift"
  | "BankInstant";
export type TransactionType = "C2C" | "C2B" | "B2C" | "B2B";
export type RateType = "Fixed" | "Variable" | "Hybrid" | "Bracket";
export type ConnectorStatus =
  | "None"
  | "Restricted"
  | "Planned"
  | "InDevelopment"
  | "Testing"
  | "Online"
  | "Offline"
  | "MajorOutage"
  | "ServiceInterruptions"
  | "Closed";
export type ConnectTransactionStatus =
  | "Authorized"
  | "Initiated"
  | "Successful"
  | "Failed"
  | "Pending"
  | "PendingAuthorization"
  | "RefundPending"
  | "RefundProcessing"
  | "Refunded"
  | "RefundFailed"
  | "Processing"
  | "PaymentPending"
  | "PaymentProcessing"
  | "PaymentFailed"
  | "Unknown"
  | "AuthorizedFailed";
export type QuoteDirection = "Send" | "Receive";
export type FundingNetwork = "Stellar";
export type MemoType = "Id" | "Hash" | "Text" | "Muxed";

// ── Shared sub-types ──────────────────────────────────────────────────────────

export interface LimitResponse {
  id: string;
  scope: string;
  type: string;
  min: number;
  max: number;
}

export interface FeeDto {
  id: string;
  feeType: string;
  value: number;
  currency: string;
}

export interface AssetResponse {
  id: string;
  assetCode: string;
  issuer: string;
  currency: string;
}

export interface CountryResponse {
  id: string;
  name: string;
  isoCode: string;
}

export interface MethodProviderResponse {
  id: string;
  name: string;
}

export interface ProviderAccountResponse {
  id: string;
  publicKey: string;
}

export interface SupportedTransactionTypeDto {
  c2c: boolean;
  c2b: boolean;
  b2c: boolean;
  b2b: boolean;
}

// ── Routes + Providers (mutually referencing, defined together) ───────────────

export interface RouteResponse {
  routeId: string;
  name: string;
  direction: PaymentDirection;
  method: RampMethod;
  subRampMethod: SubRampMethod;
  methodProvider: MethodProviderResponse;
  country: CountryResponse;
  settlementAsset: AssetResponse;
  limits: LimitResponse[];
  fees: FeeDto[];
  paymentProvider: PaymentProviderResponse;
  isActive: boolean;
  rateType: RateType;
  externalIdentifier: number;
  supportedTransactionType?: SupportedTransactionTypeDto;
}

export interface PaymentProviderResponse {
  id: string;
  name: string;
  internalName: string;
  routes: RouteResponse[];
  accounts: ProviderAccountResponse[];
  isActive: boolean;
  created: string;
  updated: string;
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export interface QRCodeDto {
  rawCode: string;
}

export interface QuoteRequest {
  connectorId: string;
  transactionType?: TransactionType;
  amount: number;
  qr?: QRCodeDto;
}

export interface QuoteFundingAssetDto {
  code: string;
  issuer: string;
}

export interface QuoteFundingDto {
  network: FundingNetwork;
  destinationAccount: string;
  asset: QuoteFundingAssetDto;
  memoType: MemoType;
  memo: string;
}

export interface QuoteResponse {
  quoteId: string;
  connectorId: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  direction: QuoteDirection;
  rate: number;
  fee: number;
  feeCurrency: string;
  total: number;
  createdAt: string;
  expiresAt: string;
  transactionType: TransactionType;
  fundingInstructions?: QuoteFundingDto;
  metadata?: Record<string, unknown>;
}

// ── KYC / payment detail DTOs ─────────────────────────────────────────────────

export interface PersonDto {
  firstName?: string;
  middlename?: string;
  lastname?: string;
  nationalityCc?: string;
  dob?: string;
  countryOfBirth?: string;
  gender?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  countryIsoCode?: string;
  msisdn: string;
  email?: string;
  idType?: string;
  idCountryIsoCode?: string;
  idNumber?: string;
  idExpiryDate?: string;
  occupation?: string;
  provinceState?: string;
  beneficiaryRelationship?: string;
  sourceOfFunds?: string;
}

export interface BusinessSenderDto {
  registered_name: string;
  trading_name: string;
  address: string;
  postal_code: string;
  city: string;
  country_iso_code: string;
  msisdn: string;
  email: string;
  date_of_incorporation: string;
  representative_lastname: string;
  representative_firstname: string;
  representative_id_country_iso_code: string;
  province_state?: string;
  registration_number?: string;
  code?: string;
  tax_id?: string;
  representative_lastname2?: string;
  representative_middlename?: string;
  representative_nativename?: string;
  representative_id_type?: string;
  representative_id_number?: string;
  representative_id_delivery_date?: string;
  representative_id_expiration_date?: string;
  business_relationship?: string;
}

export interface BusinessBeneficiaryDto {
  registered_name: string;
  trading_name: string;
  address: string;
  postal_code: string;
  city: string;
  country_iso_code: string;
  msisdn: string;
  email: string;
  date_of_incorporation: string;
  representative_lastname: string;
  representative_firstname: string;
  representative_id_country_iso_code: string;
  province_state?: string;
  registration_number?: string;
  tax_id?: string;
  representative_lastname2?: string;
  representative_middlename?: string;
  representative_nativename?: string;
  representative_id_type?: string;
  representative_id_number?: string;
  representative_id_delivery_date?: string;
  representative_id_expiration_date?: string;
}

export interface SettlementDto {
  account: string;
}

export interface RefundDto {
  account: string;
}

export interface MobileMoneyDto {
  msisdn?: string;
  accountNumber?: string;
}

export interface BankDto {
  accountNumber: string;
  branchCode?: string;
  accountName?: string;
  accountType?: string;
  swiftCode?: string;
  iban?: string;
  clabe?: string;
  cbu?: string;
  cbu_alias?: string;
  bik_code?: string;
  ifs_code?: string;
  sort_code?: string;
  aba_routing_number?: string;
  bsb_number?: string;
  routing_code?: string;
  entity_tt_id?: string;
  email?: string;
  card_number?: string;
  qr_code?: string;
  bankId?: number;
}

export interface VoucherDto {
  product: string;
}

export interface CashDto {
  reference: string;
}

export interface QRDto {
  amount: number;
  tip: number;
}

// ── OnRamp ────────────────────────────────────────────────────────────────────

export interface OnRampRequest {
  reference: string;
  quoteId: string;
  purpose?: string;
  settlementAccount: SettlementDto;
  sender?: PersonDto;
  beneficiary?: PersonDto;
  mobileMoney?: MobileMoneyDto;
  bank?: BankDto;
}

export interface OnRampResponse {
  status: ConnectTransactionStatus;
  transactionId: string;
  externalReference: string;
  routeId: string;
  createdAt: string;
}

export interface OnRampSenderDto {
  firstName: string;
  middlename?: string;
  lastname: string;
  nationality_cc: string;
  dob: string;
  idType: string;
  idCountryIsoCode: string;
  idNumber: string;
}

export interface FundingDestinationAssetDto {
  code: string;
  issuer: string;
}

export interface FundingDestinationDto {
  network: string;
  walletAddress: string;
  asset: FundingDestinationAssetDto;
}

export interface OnRampCashInRequest {
  reference: string;
  routeId: string;
  minLimit: number;
  maxLimit: number;
  amount: number;
  purpose: string;
  sender: OnRampSenderDto;
  fundingDestination: FundingDestinationDto;
}

export interface OnRampCashInResponse {
  reference: string;
  transactionId: string;
  providerName: string;
  epReference: string;
  expiresAt: string;
  status: ConnectTransactionStatus;
}

// ── OffRamp ───────────────────────────────────────────────────────────────────

export interface OffRampRequest {
  reference: string;
  quoteId: string;
  refundAccount: RefundDto;
  transactionHash: string;
  purpose?: string;
  sender?: PersonDto;
  businessSender?: BusinessSenderDto;
  beneficiary?: PersonDto;
  businessBeneficiary?: BusinessBeneficiaryDto;
  mobileMoney?: MobileMoneyDto;
  bank?: BankDto;
  voucher?: VoucherDto;
  cash?: CashDto;
  qr?: QRDto;
}

export interface OffRampResponse {
  status: ConnectTransactionStatus;
  transactionId: string;
  externalReference: string;
  connectorId: string;
  createdAt: string;
}

// ── Execute (gateway-rewritten offramp lane) ──────────────────────────────────

export interface ExecuteRequest {
  quoteId: string;
  txHash: string;
  destination: unknown;
  memo?: string;
}

export interface ExecuteResponse {
  transactionId: string;
  status: string;
  [k: string]: unknown;
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface ConnectStatusResponse {
  transactionId: string;
  status: ConnectTransactionStatus;
  updated: string;
}

// ── Integrator ────────────────────────────────────────────────────────────────

export interface IntegratorAccountResponse {
  publicKey: string;
  vaultId: string;
}

export interface WebhookResponse {
  id: string;
  url: string;
}

export interface IntegratorResponse {
  id: string;
  name: string;
  settlementAccount: IntegratorAccountResponse;
  webhooks: WebhookResponse[];
  limits: LimitResponse[];
}

// ── Platform health ───────────────────────────────────────────────────────────

export interface ApiHealth {
  latencyP95Ms: number;
  errorRate15m: number;
}

export interface DependencyHealth {
  name: string;
  type: string;
  status: string;
  latencyMs?: number;
  lastSuccessUtc?: string;
  lastOutage?: string;
}

export interface MaintenanceWindow {
  start: string;
  end: string;
  message: string;
}

export interface PlatformStatus {
  maintenanceWindow?: MaintenanceWindow;
  allowedOperations: Record<string, string>;
}

export interface PlatformHealthResponse {
  status: string;
  message: string;
  timestampUtc: string;
  region: string;
  environment: string;
  version: string;
  uptimeSeconds: number;
  api: ApiHealth;
  dependencies: DependencyHealth[];
  platform: PlatformStatus;
}

// ── GraphQL connectors ────────────────────────────────────────────────────────

export interface Connector {
  id: string;
  name: string;
  method: string;
  isActive: boolean;
  acceptedAsset: string;
  destinationAsset: string;
  requiresQuote: boolean;
  fees?: unknown;
  limits?: unknown;
  execution?: unknown;
  [k: string]: unknown;
}

export interface ConnectorQueryInput {
  countryISO: string;
  method: string;
}
