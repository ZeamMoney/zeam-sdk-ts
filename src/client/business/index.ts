import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { parseAsset } from "../../stellar/index.js";
import { call } from "../call.js";
import { associationMethods } from "./associations/index.js";
import { assetMethods } from "./assets/index.js";
import { beneficiaryMethods } from "./beneficiaries/index.js";
import { walletMethods } from "./wallets/index.js";

export type { Association } from "./associations/index.js";
export type { Asset, AssetDTO } from "./assets/index.js";
export type {
  Beneficiary,
  BeneficiaryBusiness,
  BeneficiaryIndividual,
  BeneficiaryInput,
  BeneficiaryListParams,
  BeneficiaryListResult,
  BeneficiaryTags,
  BeneficiaryType,
  BulkCreateResult,
  Connector,
  ConnectorsResult,
  PaymentDestination,
  PaymentDestinationInput,
  PaymentDestinationsResult,
  PaymentMethod,
} from "./beneficiaries/index.js";
export type {
  CreateWalletInput,
  CreateWalletResult,
  UpdateWalletInput,
  Wallet,
  WalletDTO,
  WalletTransactionInput,
  WalletTransactionResult,
  WalletType,
} from "./wallets/index.js";

export interface StellarQuoteInput {
  fromAsset: string;
  toAsset: string;
  amount: string;
}

export interface StellarQuote {
  sendMax: string;
  path?: unknown;
  fx?: unknown;
  [k: string]: unknown;
}

/**
 * Wraps `/v1/business/*`. Requires a Firebase-backed Business session.
 * Methods are implemented in domain subfolders and composed here.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface BusinessClient
  extends ReturnType<typeof associationMethods>,
    ReturnType<typeof assetMethods>,
    ReturnType<typeof walletMethods>,
    ReturnType<typeof beneficiaryMethods> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class BusinessClient {
  constructor(private doer: Doer) {
    Object.assign(
      this,
      associationMethods(doer),
      assetMethods(doer),
      walletMethods(doer),
      beneficiaryMethods(doer),
    );
  }

  stellarQuote(
    session: Session,
    input: StellarQuoteInput,
    signal?: AbortSignal,
  ): Promise<StellarQuote> {
    parseAsset(input.fromAsset);
    parseAsset(input.toAsset);
    return call<StellarQuote>(this.doer, {
      method: "POST",
      path: "/v1/stellar/quote",
      session,
      requireTrack: Track.Business,
      body: input,
      signal,
    });
  }
}
