import { Track, type Session } from "../auth/index.js";
import type { Client } from "../client.js";
import {
  BusinessClient,
  type Association,
  type Beneficiary,
  type StellarQuote,
  type Wallet,
} from "../client/business/index.js";
import {
  ConnectClient,
  type Connector,
  type ExecuteResponse,
  type QuoteResponse,
} from "../client/connect/index.js";
import { Keypair, parseAsset, type Asset, assetString, assetsEqual } from "../stellar/index.js";

export interface ConnectPaymentInput {
  /** Authenticated Business session (typically from `loginOTP`). */
  businessSession: Session;
  /** Stellar credentials captured at registration. */
  applicationSeed: string;
  applicationPublicKey: string;
  /** Chosen association (Step 1). */
  associationId: string;
  /** Chosen wallet (Step 2). */
  walletId: string;
  /** The asset the wallet holds and will debit. */
  fundingAsset: Asset;
  /** Beneficiary (Step 3). */
  beneficiaryId: string;
  /** Must match the gateway enum regex and the beneficiary destination. */
  method: string;
  countryISO: string;
  /** Amount in the Connect-quoted accepted asset. Max 7 fractional digits. */
  sendAmount: string;
  memo?: string;
  memoType?: "Text" | "Hash" | "ID";
  /** Partner-supplied connect secret (captured at registration). */
  connectSecret: string;
  signal?: AbortSignal;
}

export interface ConnectPaymentResult {
  connectTransactionId: string;
  connectStatus: string;
  stellarTxHash: string;
  quoteId: string;
  connector: Connector;
  connectSession: Session;
}

/**
 * 9-step Connect off-ramp orchestration. Individual steps are exposed
 * on the class so callers can interleave their own UX (e.g. show a
 * confirmation after `getConnectQuote`).
 */
export class ConnectPayment {
  readonly business: BusinessClient;
  readonly connect: ConnectClient;

  associations?: Association[];
  wallets?: Wallet[];
  beneficiary?: Beneficiary;
  connectSession?: Session;
  connectors?: Connector[];
  selected?: Connector;
  connectQuote?: QuoteResponse;
  stellarQuote?: StellarQuote;
  walletTxHash?: string;
  executeResult?: ExecuteResponse;

  constructor(
    private client: Client,
    private input: ConnectPaymentInput,
  ) {
    this.validate();
    this.business = new BusinessClient(client);
    this.connect = new ConnectClient(client, input.connectSecret);
  }

  /** Run every step in order. */
  async do(): Promise<ConnectPaymentResult> {
    await this.listAssociations();
    await this.listWallets();
    await this.getBeneficiary();
    await this.signInConnect();
    await this.discoverConnectors();
    this.selectConnector();
    await this.getConnectQuote();
    if (this.requiresStellarQuote()) await this.getStellarQuote();
    await this.executeStellarTransaction();
    await this.executeConnectPayment();

    if (!this.executeResult || !this.connectQuote || !this.selected || !this.connectSession) {
      throw new Error("recipes: ConnectPayment completed without populating all step outputs");
    }
    return {
      connectTransactionId: this.executeResult.transactionId,
      connectStatus: this.executeResult.status,
      stellarTxHash: this.walletTxHash ?? "",
      quoteId: this.connectQuote.quoteId,
      connector: this.selected,
      connectSession: this.connectSession,
    };
  }

  private validate(): void {
    const i = this.input;
    if (i.businessSession.track !== Track.Business) {
      throw new Error("recipes: businessSession must be on TrackBusiness");
    }
    if (!i.applicationSeed || !i.applicationPublicKey) {
      throw new Error("recipes: applicationSeed and applicationPublicKey are required");
    }
    if (!i.associationId || !i.walletId || !i.beneficiaryId) {
      throw new Error("recipes: association, wallet, and beneficiary IDs are required");
    }
    if (!i.method || !i.countryISO) throw new Error("recipes: method and countryISO are required");
    if (!i.sendAmount) throw new Error("recipes: sendAmount is required");
    if (!i.connectSecret) throw new Error("recipes: connectSecret is required");
  }

  async listAssociations(): Promise<Association[]> {
    this.associations = await this.business.listAssociations(
      this.input.businessSession,
      this.input.signal,
    );
    return this.associations;
  }

  async listWallets(): Promise<Wallet[]> {
    this.wallets = await this.business.listWalletsByAssociation(
      this.input.businessSession,
      this.input.associationId,
      this.input.signal,
    );
    return this.wallets;
  }

  async getBeneficiary(): Promise<Beneficiary> {
    this.beneficiary = await this.business.getBeneficiary(
      this.input.businessSession,
      this.input.associationId,
      this.input.beneficiaryId,
      this.input.signal,
    );
    return this.beneficiary;
  }

  async signInConnect(): Promise<Session> {
    const kp = Keypair.new(this.input.applicationSeed, this.input.applicationPublicKey);
    try {
      const sess = await this.client.sep10.login(kp);
      await this.client.tokenStore.put(sess);
      this.connectSession = sess;
      return sess;
    } finally {
      kp.erase();
    }
  }

  async discoverConnectors(): Promise<Connector[]> {
    if (!this.connectSession) throw new Error("recipes: connect session not established");
    this.connectors = await this.connect.queryConnectors(
      this.connectSession,
      { countryISO: this.input.countryISO, method: this.input.method },
      this.input.signal,
    );
    return this.connectors;
  }

  selectConnector(): Connector {
    if (this.selected) return this.selected;
    const match = this.connectors?.find((c) => c.isActive && c.method === this.input.method);
    if (!match) {
      throw new Error(
        `recipes: no active connector for ${this.input.method} in ${this.input.countryISO}`,
      );
    }
    this.selected = match;
    return match;
  }

  async getConnectQuote(): Promise<QuoteResponse> {
    if (!this.connectSession || !this.selected) {
      throw new Error("recipes: selectConnector and signInConnect must run first");
    }
    const destination = this.destinationPayload();
    this.connectQuote = await this.connect.getQuote(
      this.connectSession,
      {
        connector_id: this.selected.id,
        amount: this.input.sendAmount,
        currency: this.selected.acceptedAsset,
        destination,
      },
      this.input.signal,
    );
    return this.connectQuote;
  }

  /** Decision rule from docs/CONNECT_PAYMENT_FLOW.md §3. */
  requiresStellarQuote(): boolean {
    if (!this.connectQuote) return false;
    try {
      const accepted = parseAsset(this.connectQuote.acceptedAsset);
      return !assetsEqual(this.input.fundingAsset, accepted);
    } catch {
      return false;
    }
  }

  async getStellarQuote(): Promise<StellarQuote> {
    if (!this.connectQuote) throw new Error("recipes: connect quote missing");
    this.stellarQuote = await this.business.stellarQuote(
      this.input.businessSession,
      {
        fromAsset: assetString(this.input.fundingAsset),
        toAsset: this.connectQuote.acceptedAsset,
        amount: this.connectQuote.sendAmount,
      },
      this.input.signal,
    );
    return this.stellarQuote;
  }

  async executeStellarTransaction(): Promise<string> {
    if (!this.connectQuote) throw new Error("recipes: connect quote missing");
    const toPublicKey = this.connectQuote.clearingAccount ?? "";
    if (!toPublicKey) {
      throw new Error(
        "recipes: connect quote did not return a clearingAccount; cannot build Stellar transaction",
      );
    }
    const body: Record<string, unknown> = {
      toPublicKey,
      fromAsset: assetString(this.input.fundingAsset),
      amount: this.connectQuote.sendAmount,
      memo: this.input.memo,
      memoType: this.input.memoType,
    };
    if (this.requiresStellarQuote()) {
      body.toAsset = this.connectQuote.acceptedAsset;
      body.sendMax = this.stellarQuote?.sendMax;
    }
    const result = await this.business.executeWalletTransaction(
      this.input.businessSession,
      this.input.walletId,
      body as unknown as Parameters<BusinessClient["executeWalletTransaction"]>[2],
      this.input.signal,
    );
    this.walletTxHash = result.txHash;
    return result.txHash;
  }

  async executeConnectPayment(): Promise<ExecuteResponse> {
    if (!this.connectSession || !this.connectQuote || !this.walletTxHash) {
      throw new Error("recipes: prior steps have not completed");
    }
    const destination = this.destinationPayload();
    this.executeResult = await this.connect.execute(
      this.connectSession,
      {
        quoteId: this.connectQuote.quoteId,
        txHash: this.walletTxHash,
        destination,
        memo: this.input.memo,
      },
      this.input.signal,
    );
    return this.executeResult;
  }

  private destinationPayload(): unknown {
    if (!this.beneficiary) throw new Error("recipes: beneficiary not loaded");
    const match = this.beneficiary.payment_destinations.find(
      (d) => d.method === this.input.method && d.country_iso === this.input.countryISO,
    );
    if (!match) {
      throw new Error(
        `recipes: no beneficiary destination for method=${this.input.method} country=${this.input.countryISO}`,
      );
    }
    return match;
  }
}

/** Convenience factory mirroring the Go SDK's `NewConnectPayment`. */
export function newConnectPayment(client: Client, input: ConnectPaymentInput): ConnectPayment {
  return new ConnectPayment(client, input);
}
