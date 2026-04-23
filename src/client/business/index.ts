import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { parseAsset } from "../../stellar/index.js";
import { call } from "../call.js";

export interface Association {
  id: string;
  association_name: string;
  [k: string]: unknown;
}

export interface Wallet {
  id: string;
  publicKey: string;
  type: string;
  balances?: unknown;
  [k: string]: unknown;
}

export interface PaymentDestination {
  id: string;
  method: string;
  country_iso: string;
  is_primary: boolean;
  [k: string]: unknown;
}

export interface Beneficiary {
  id: string;
  payment_destinations: PaymentDestination[];
  [k: string]: unknown;
}

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

export interface WalletTransactionInput {
  toPublicKey: string;
  fromAsset: string;
  toAsset?: string;
  amount: string;
  sendMax?: string;
  memo?: string;
  memoType?: string;
}

export interface WalletTransactionResult {
  txHash: string;
  xdr?: string;
  [k: string]: unknown;
}

/**
 * Wraps `/v1/business/*`. Requires a Firebase-backed Business session.
 */
export class BusinessClient {
  constructor(private doer: Doer) {}

  listAssociations(session: Session, signal?: AbortSignal): Promise<Association[]> {
    return call<Association[]>(this.doer, {
      method: "GET",
      path: "/v1/business/association/all",
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  listWalletsByAssociation(
    session: Session,
    associationId: string,
    signal?: AbortSignal,
  ): Promise<Wallet[]> {
    return call<Wallet[]>(this.doer, {
      method: "GET",
      path: `/v1/business/wallet/association/${encodeURIComponent(associationId)}`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  getBeneficiary(
    session: Session,
    associationId: string,
    beneficiaryId: string,
    signal?: AbortSignal,
  ): Promise<Beneficiary> {
    return call<Beneficiary>(this.doer, {
      method: "GET",
      path: `/v1/business/beneficiaries/${encodeURIComponent(associationId)}/${encodeURIComponent(
        beneficiaryId,
      )}`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  /**
   * POST /v1/business/stellar/quote. Validates both assets locally
   * before the network call.
   */
  stellarQuote(
    session: Session,
    input: StellarQuoteInput,
    signal?: AbortSignal,
  ): Promise<StellarQuote> {
    parseAsset(input.fromAsset); // throws on malformed
    parseAsset(input.toAsset);
    return call<StellarQuote>(this.doer, {
      method: "POST",
      path: "/v1/business/stellar/quote",
      session,
      requireTrack: Track.Business,
      body: input,
      signal,
    });
  }

  executeWalletTransaction(
    session: Session,
    walletId: string,
    input: WalletTransactionInput,
    signal?: AbortSignal,
  ): Promise<WalletTransactionResult> {
    return call<WalletTransactionResult>(this.doer, {
      method: "POST",
      path: `/v1/business/wallet/${encodeURIComponent(walletId)}/transaction`,
      session,
      requireTrack: Track.Business,
      body: input,
      signal,
    });
  }
}
