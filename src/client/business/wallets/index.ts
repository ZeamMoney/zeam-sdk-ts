import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export interface Wallet {
  id: string;
  walletName: string;
  publicKey: string;
  accountNumber: string;
  binId: string;
  custodial: boolean;
  hasMultipleSigners: boolean;
  networkId: string;
  sequenceNumber: number;
  typeId: string;
  vaultId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDTO {
  id: string;
  walletName: string;
  publicKey: string;
  accountNumber: string;
  custodial: boolean;
  networkId: string;
  typeId: string;
  associationId: string;
  associationName: string;
}

export interface WalletType {
  id: string;
  name: string;
  description: string;
  custodyType: string;
  isActive: boolean;
  productId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletInput {
  walletName: string;
  typeId: string;
  networkId: string;
  associationId?: string;
}

export interface CreateWalletResult {
  id: string;
  publicKey: string;
  vaultId: string;
}

export interface UpdateWalletInput {
  walletName?: string;
  label?: string;
  typeId?: string;
  networkId?: string;
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
  id: string;
  identityId: string;
  publicKey: string;
  transactionHash: string;
  transactionXdr: string;
  resultXdr: string;
  transactionDescription: string;
  amount: string;
  asset: string;
  createdAt: string;
}

export function walletMethods(doer: Doer) {
  return {
    listWalletsByAssociation(
      session: Session,
      associationId: string,
      signal?: AbortSignal,
    ): Promise<Wallet[]> {
      return call<Wallet[]>(doer, {
        method: "GET",
        path: `/v1/business/wallet/association/${encodeURIComponent(associationId)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    listAllWallets(session: Session, signal?: AbortSignal): Promise<Wallet[]> {
      return call<Wallet[]>(doer, {
        method: "GET",
        path: "/v1/business/wallet/all",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    listWalletTypes(session: Session, signal?: AbortSignal): Promise<WalletType[]> {
      return call<WalletType[]>(doer, {
        method: "GET",
        path: "/v1/business/wallet/type",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getWalletById(session: Session, id: string, signal?: AbortSignal): Promise<Wallet> {
      return call<Wallet>(doer, {
        method: "GET",
        path: `/v1/business/wallet/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getWalletDTOById(session: Session, id: string, signal?: AbortSignal): Promise<WalletDTO> {
      return call<WalletDTO>(doer, {
        method: "GET",
        path: `/v1/business/wallet/dto/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    createWallet(
      session: Session,
      input: CreateWalletInput,
      signal?: AbortSignal,
    ): Promise<CreateWalletResult> {
      return call<CreateWalletResult>(doer, {
        method: "POST",
        path: "/v1/business/wallet",
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    updateWallet(
      session: Session,
      id: string,
      input: UpdateWalletInput,
      signal?: AbortSignal,
    ): Promise<Wallet> {
      return call<Wallet>(doer, {
        method: "PUT",
        path: `/v1/business/wallet/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    executeWalletTransaction(
      session: Session,
      walletId: string,
      input: WalletTransactionInput,
      signal?: AbortSignal,
    ): Promise<WalletTransactionResult> {
      return call<WalletTransactionResult>(doer, {
        method: "POST",
        path: `/v1/business/wallet/${encodeURIComponent(walletId)}/transaction`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },
  };
}
