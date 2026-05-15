import type { Doer } from "../../client.js";
import { assetMethods } from "./assets/index.js";
import { connectorMethods } from "./connectors/index.js";
import { countryMethods } from "./countries/index.js";
import { integratorMethods } from "./integrator/index.js";
import { offRampMethods } from "./offramp/index.js";
import { onRampMethods } from "./onramp/index.js";
import { platformMethods } from "./platform/index.js";
import { providerMethods } from "./providers/index.js";
import { quoteMethods } from "./quotes/index.js";
import { routeMethods } from "./routes/index.js";
import { statusMethods } from "./status/index.js";

export { EXEC_PATH_RE } from "./connectors/index.js";

export type { AssetResponse } from "./assets/index.js";
export type { Connector, ConnectorQueryInput } from "./connectors/index.js";
export type { CountryResponse } from "./countries/index.js";
export type { IntegratorResponse } from "./integrator/index.js";
export type {
  ExecuteRequest,
  ExecuteResponse,
  OffRampRequest,
  OffRampResponse,
} from "./offramp/index.js";
export type {
  OnRampCashInRequest,
  OnRampCashInResponse,
  OnRampRequest,
  OnRampResponse,
} from "./onramp/index.js";
export type { PlatformHealthResponse } from "./platform/index.js";
export type { PaymentProviderResponse } from "./providers/index.js";
export type { QuoteDirection, QuoteRequest, QuoteResponse } from "./quotes/index.js";
export type { RouteResponse } from "./routes/index.js";
export type { ConnectStatusResponse } from "./status/index.js";
export type {
  ApiHealth,
  BankDto,
  BusinessBeneficiaryDto,
  BusinessSenderDto,
  CashDto,
  ConnectTransactionStatus,
  ConnectorStatus,
  DependencyHealth,
  FeeDto,
  FundingDestinationAssetDto,
  FundingDestinationDto,
  FundingNetwork,
  LimitResponse,
  MaintenanceWindow,
  MemoType,
  MethodProviderResponse,
  MobileMoneyDto,
  OnRampSenderDto,
  PaymentDirection,
  PersonDto,
  PlatformStatus,
  ProviderAccountResponse,
  QRCodeDto,
  QRDto,
  QuoteFundingAssetDto,
  QuoteFundingDto,
  RampMethod,
  RateType,
  RefundDto,
  SettlementDto,
  SubRampMethod,
  SupportedTransactionTypeDto,
  TransactionType,
  VoucherDto,
  WebhookResponse,
} from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ConnectClient
  extends ReturnType<typeof routeMethods>,
    ReturnType<typeof providerMethods>,
    ReturnType<typeof countryMethods>,
    ReturnType<typeof assetMethods>,
    ReturnType<typeof quoteMethods>,
    ReturnType<typeof offRampMethods>,
    ReturnType<typeof onRampMethods>,
    ReturnType<typeof statusMethods>,
    ReturnType<typeof integratorMethods>,
    ReturnType<typeof platformMethods>,
    ReturnType<typeof connectorMethods> {}

/**
 * Wraps all `/v1/connect-*` endpoints. Requires a Connect (SEP-10) session
 * AND the integrator secret captured at registration.
 *
 * Methods are implemented in domain subfolders and composed here.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ConnectClient {
  constructor(doer: Doer, connectSecret: string) {
    Object.assign(
      this,
      routeMethods(doer, connectSecret),
      providerMethods(doer, connectSecret),
      countryMethods(doer, connectSecret),
      assetMethods(doer, connectSecret),
      quoteMethods(doer, connectSecret),
      offRampMethods(doer, connectSecret),
      onRampMethods(doer, connectSecret),
      statusMethods(doer, connectSecret),
      integratorMethods(doer, connectSecret),
      platformMethods(doer, connectSecret),
      connectorMethods(doer, connectSecret),
    );
  }
}
