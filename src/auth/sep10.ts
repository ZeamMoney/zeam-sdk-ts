import { WrongTrackError } from "../errors.js";
import type { ChallengeSigner, Keypair } from "../stellar/index.js";
import { expiryFromExpiresIn, type Fetcher } from "./otp.js";
import { Session } from "./session.js";
import { Track } from "./tracks.js";

interface Challenge {
  transaction: string;
  network_passphrase: string;
}

interface TokenResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * SEP10Flow runs the Connect SEP-10 authentication flow. Unlike the
 * Business surface, `/auth-connect*` is bare JSON (not SPEC §18).
 */
export class SEP10Flow {
  constructor(
    private readonly baseURL: URL,
    private readonly fetcher: Fetcher,
    private readonly signer: ChallengeSigner,
  ) {}

  /**
   * GET /v1/public/auth-connect?account=<pubkey> — returns the challenge XDR.
   */
  async getChallenge(account: string): Promise<Challenge> {
    if (!account) throw new Error("auth: account is required");
    const u = new URL("/v1/public/auth-connect", this.baseURL);
    u.searchParams.set("account", account);
    const out = await this.getBareJSON<Challenge>(u);
    if (!out.transaction) throw new Error("auth: empty challenge XDR");
    return out;
  }

  /**
   * POST /v1/public/auth-connect — returns the Connect session.
   */
  async submitSigned(signedXDR: string, subject?: string): Promise<Session> {
    if (!signedXDR) throw new Error("auth: signed XDR is required");
    const u = new URL("/v1/public/auth-connect", this.baseURL);
    const resp = await this.postBareJSON<TokenResponse>(u, { transaction: signedXDR });
    return new Session({
      track: Track.Connect,
      idToken: resp.idToken,
      refreshToken: resp.refreshToken,
      expiresAt: expiryFromExpiresIn(resp.expiresIn),
      subject,
    });
  }

  /**
   * Full SEP-10 round-trip with the supplied keypair. Used by
   * `connectLogin` and `connectPayment` recipes.
   */
  async login(keypair: Keypair): Promise<Session> {
    if (!keypair.canSign()) throw new Error("auth: keypair cannot sign (no seed)");
    const challenge = await this.getChallenge(keypair.publicKey);
    const signed = await this.signer.sign(challenge.transaction, keypair);
    return this.submitSigned(signed, keypair.publicKey);
  }

  /**
   * Refresh a Connect session. Satisfies [Refresher].
   */
  async refresh(session: Session): Promise<Session> {
    if (session.track !== Track.Connect) throw new WrongTrackError();
    const u = new URL("/v1/public/auth-connect/refresh", this.baseURL);
    const resp = await this.postBareJSON<TokenResponse>(u, { refreshToken: session.refreshToken });
    session.update(resp.idToken, resp.refreshToken, expiryFromExpiresIn(resp.expiresIn));
    return session;
  }

  private async getBareJSON<T>(u: URL): Promise<T> {
    const req = new Request(u, { method: "GET", headers: { Accept: "application/json" } });
    return this.doAndDecode<T>(req);
  }

  private async postBareJSON<T>(u: URL, body: unknown): Promise<T> {
    const req = new Request(u, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return this.doAndDecode<T>(req);
  }

  private async doAndDecode<T>(req: Request): Promise<T> {
    const resp = await this.fetcher(req);
    const raw = await resp.text();
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`auth: ${req.method} ${new URL(req.url).pathname} status ${resp.status}`);
    }
    return JSON.parse(raw) as T;
  }
}
