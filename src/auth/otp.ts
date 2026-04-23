import { WrongTrackError } from "../errors.js";
import { Session } from "./session.js";
import { Track } from "./tracks.js";

/**
 * Subset of fetch-like surface the flows consume. Keeps testing simple.
 */
export type Fetcher = (req: Request) => Promise<Response>;

interface VerifyResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  customToken?: string;
}

interface ChallengeResponse {
  requestId: string;
  maskedDestination: string;
  expiresAt: string;
}

/**
 * OTPFlow runs the Business OTP login against the gateway's public
 * `/v1/public/auth/*` surface.
 */
export class OTPFlow {
  constructor(
    private readonly baseURL: URL,
    private readonly fetcher: Fetcher,
  ) {}

  /**
   * Start the OTP flow. Returns the opaque requestId the caller must
   * echo back on verify.
   */
  async requestOTP(input: { mobileNumber: string }): Promise<ChallengeResponse> {
    if (!input.mobileNumber) throw new Error("auth: mobileNumber is required");
    const out = await this.post<ChallengeResponse>("/v1/public/auth/request-otp", input);
    if (!out.requestId) throw new Error("auth: upstream did not return a requestId");
    return out;
  }

  /**
   * Exchange an OTP code for a Business session.
   */
  async verifyOTP(input: { requestId: string; code: string; subject?: string }): Promise<Session> {
    if (!input.requestId || !input.code) {
      throw new Error("auth: requestId and code are required");
    }
    const resp = await this.post<VerifyResponse>("/v1/public/auth/verify-otp", {
      requestId: input.requestId,
      code: input.code,
    });
    return new Session({
      track: Track.Business,
      idToken: resp.idToken,
      refreshToken: resp.refreshToken,
      expiresAt: expiryFromExpiresIn(resp.expiresIn),
      subject: input.subject,
    });
  }

  /**
   * Refresh a Business session. Satisfies [Refresher].
   */
  async refresh(session: Session): Promise<Session> {
    if (session.track !== Track.Business) throw new WrongTrackError();
    const resp = await this.post<VerifyResponse>("/v1/public/auth/refresh", {
      refreshToken: session.refreshToken,
    });
    session.update(resp.idToken, resp.refreshToken, expiryFromExpiresIn(resp.expiresIn));
    return session;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const req = new Request(new URL(path, this.baseURL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const resp = await this.fetcher(req);
    const raw = await resp.text();
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`auth: ${path} returned status ${resp.status}`);
    }
    try {
      const parsed = JSON.parse(raw) as { ok?: boolean; data?: unknown };
      if (parsed && parsed.ok === true && "data" in parsed) {
        return parsed.data as T;
      }
      return parsed as T;
    } catch {
      throw new Error(`auth: ${path} response was not JSON`);
    }
  }
}

/**
 * Parse the upstream's `expiresIn` (seconds, often as a numeric string)
 * into an absolute expiry timestamp.
 */
export function expiryFromExpiresIn(s: string | number): Date {
  if (s === undefined || s === null || s === "") {
    throw new Error("auth: missing expiresIn");
  }
  const n = typeof s === "number" ? s : Number(String(s).trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`auth: invalid expiresIn ${JSON.stringify(s)}`);
  }
  return new Date(Date.now() + n * 1000);
}
