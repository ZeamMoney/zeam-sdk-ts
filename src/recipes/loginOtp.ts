import type { Session } from "../auth/index.js";
import type { Client } from "../client.js";

/** Non-sensitive hint carried in the OTP request response. */
export interface OTPHint {
  maskedDestination: string;
  requestId: string;
}

export interface LoginOTPInput {
  mobileNumber: string;
  /** Partner-supplied UX callback returning the code the end user typed. */
  askCode: (hint: OTPHint) => Promise<string> | string;
  /** Optional human-meaningful tag stored on the Session. */
  subject?: string;
  signal?: AbortSignal;
}

/**
 * Business OTP login end-to-end. On success returns a Session on
 * `TrackBusiness` and persists it in `client.tokenStore`.
 */
export async function loginOTP(client: Client, input: LoginOTPInput): Promise<Session> {
  if (!input.mobileNumber) throw new Error("recipes: mobileNumber is required");
  if (!input.askCode) throw new Error("recipes: askCode callback is required");

  const challenge = await client.otp.requestOTP({ mobileNumber: input.mobileNumber });
  const code = await input.askCode({
    maskedDestination: challenge.maskedDestination,
    requestId: challenge.requestId,
  });
  const sess = await client.otp.verifyOTP({
    requestId: challenge.requestId,
    code,
    subject: input.subject,
  });
  await client.tokenStore.put(sess);
  return sess;
}
