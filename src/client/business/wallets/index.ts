import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export interface Wallet {
  id?: string;
  walletName?: string;
  publicKey?: string;
  accountNumber?: string;
  binId?: string;
  custodial?: boolean;
  hasMultipleSigners?: boolean;
  networkId?: string;
  sequenceNumber?: number;
  typeId?: string;
  vaultId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WalletDTO {
  id?: string;
  walletName?: string;
  publicKey?: string;
  accountNumber?: string;
  custodial?: boolean;
  networkId?: string;
  typeId?: string;
  associationId?: string;
  associationName?: string;
}

export interface WalletType {
  id?: string;
  name?: string;
  description?: string;
  custodyType?: string;
  isActive?: boolean;
  productId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWalletInput {
  walletName: string;
  typeId: string;
  networkId: string;
  associationId?: string;
}

export interface CreateWalletResult {
  id?: string;
  publicKey?: string;
  vaultId?: string;
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
  id?: string;
  identityId?: string;
  publicKey?: string;
  transactionHash?: string;
  transactionXdr?: string;
  resultXdr?: string;
  transactionDescription?: string;
  amount?: string;
  asset?: string;
  createdAt?: string;
}

export function walletMethods(doer: Doer) {
  return {
    /**
     * List all wallets that belong to a specific association.
     *
     * `GET /v1/business/wallet/association/:associationId`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param associationId - UUID of the association whose wallets to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of {@link Wallet} records for the given association.
     *
     * @example
     * const wallets = await business.listWalletsByAssociation(session, "assoc-uuid");
     */
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

    /**
     * List every wallet across all associations for the authenticated business.
     *
     * `GET /v1/business/wallet/all`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of all {@link Wallet} records.
     *
     * @example
     * const wallets = await business.listAllWallets(session);
     */
    listAllWallets(session: Session, signal?: AbortSignal): Promise<Wallet[]> {
      return call<Wallet[]>(doer, {
        method: "GET",
        path: "/v1/business/wallet/all",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * List all available wallet types (e.g. custodial, self-custody).
     *
     * Use the returned `id` values as the `typeId` when calling
     * {@link createWallet}.
     *
     * `GET /v1/business/wallet/type`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns Array of {@link WalletType} records.
     *
     * @example
     * const types = await business.listWalletTypes(session);
     * const custodial = types.find(t => t.custodyType === "custodial");
     */
    listWalletTypes(session: Session, signal?: AbortSignal): Promise<WalletType[]> {
      return call<WalletType[]>(doer, {
        method: "GET",
        path: "/v1/business/wallet/type",
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the full details of a single wallet by its UUID.
     *
     * `GET /v1/business/wallet/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the wallet to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The matching {@link Wallet}.
     *
     * @example
     * const wallet = await business.getWalletById(session, "wallet-uuid");
     * console.log(wallet.publicKey);
     */
    getWalletById(session: Session, id: string, signal?: AbortSignal): Promise<Wallet> {
      return call<Wallet>(doer, {
        method: "GET",
        path: `/v1/business/wallet/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Fetch the lightweight DTO view of a wallet by its UUID.
     *
     * {@link WalletDTO} includes the association name but omits low-level
     * fields like `vaultId` and `sequenceNumber`. Prefer this for display use.
     *
     * `GET /v1/business/wallet/dto/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the wallet to retrieve.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The matching {@link WalletDTO}.
     *
     * @example
     * const dto = await business.getWalletDTOById(session, "wallet-uuid");
     * console.log(dto.associationName);
     */
    getWalletDTOById(session: Session, id: string, signal?: AbortSignal): Promise<WalletDTO> {
      return call<WalletDTO>(doer, {
        method: "GET",
        path: `/v1/business/wallet/dto/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    /**
     * Create a new wallet for the business.
     *
     * Use {@link listWalletTypes} to find valid `typeId` values and
     * {@link listAssociations} to find valid `associationId` values.
     *
     * `POST /v1/business/wallet`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param input - Wallet creation parameters (name, type, network, optional association).
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link CreateWalletResult} containing the new wallet's `id`, `publicKey`, and `vaultId`.
     *
     * @example
     * const result = await business.createWallet(session, {
     *   walletName: "Payouts Wallet",
     *   typeId: "type-uuid",
     *   networkId: "network-uuid",
     *   associationId: "assoc-uuid",
     * });
     * console.log(result.publicKey);
     */
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

    /**
     * Update metadata on an existing wallet.
     *
     * All fields in {@link UpdateWalletInput} are optional — only supply
     * what you want to change.
     *
     * `PUT /v1/business/wallet/:id`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param id - UUID of the wallet to update.
     * @param input - Fields to update (`walletName`, `label`, `typeId`, `networkId`).
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns The updated {@link Wallet}.
     *
     * @example
     * const updated = await business.updateWallet(session, "wallet-uuid", {
     *   walletName: "Renamed Wallet",
     * });
     */
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

    /**
     * Execute a Stellar payment from a business wallet.
     *
     * Submits a transaction on the Stellar network from the specified wallet.
     * For cross-asset payments, provide both `fromAsset` and `toAsset` in
     * Stellar asset string format (e.g. `"USDC:G..."`). Use `sendMax` when
     * doing path payments to cap slippage.
     *
     * `POST /v1/business/wallet/:walletId/transaction`
     *
     * @param session - Active Business-track session obtained from `OTPFlow`.
     * @param walletId - UUID of the source wallet that will sign and send.
     * @param input - Transaction parameters including destination, assets, and amount.
     * @param signal - Optional `AbortSignal` to cancel the in-flight request.
     * @returns {@link WalletTransactionResult} with the transaction hash and XDR.
     *
     * @example
     * const tx = await business.executeWalletTransaction(session, "wallet-uuid", {
     *   toPublicKey: "GDESTINATION...",
     *   fromAsset: "USDC:GABC...",
     *   amount: "10.00",
     *   memo: "Invoice #42",
     * });
     * console.log(tx.transactionHash);
     */
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
