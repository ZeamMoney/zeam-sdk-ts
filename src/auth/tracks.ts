/**
 * Track identifies which authentication track issued a [Session].
 * Business sessions are issued by the OTP/Firebase path and must NOT be
 * sent to /v1/connect-* endpoints; Connect sessions are issued by SEP-10
 * and must NOT be sent to Business endpoints. Mixing tracks is rejected
 * at the upstream with 401 invalid_token.
 */
export const Track = {
  Unknown: "unknown",
  Business: "business",
  Connect: "connect",
} as const;

export type Track = (typeof Track)[keyof typeof Track];
