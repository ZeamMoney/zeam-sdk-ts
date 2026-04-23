/**
 * Canonical error kind emitted by the gateway. Mirrors ADR 0003
 * amendment 2026-04-22 and is stable across SDK versions.
 */
export const Kind = {
  Unknown: "unknown",
  Validation: "validation",
  Auth: "auth",
  Authz: "authz",
  NotFound: "not_found",
  Conflict: "conflict",
  Transient: "transient",
  Remote: "remote",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

/**
 * Map an HTTP status to the canonical [Kind] per ADR 0003.
 */
export function kindFromStatus(status: number): Kind {
  switch (status) {
    case 400:
    case 422:
      return Kind.Validation;
    case 401:
      return Kind.Auth;
    case 403:
      return Kind.Authz;
    case 404:
      return Kind.NotFound;
    case 409:
      return Kind.Conflict;
    case 408:
    case 429:
    case 503:
    case 504:
      return Kind.Transient;
    default:
      if (status >= 500 && status < 600) return Kind.Remote;
      return Kind.Unknown;
  }
}

/**
 * Shape of the details object on a gateway error (ADR 0008 R5).
 */
export type ErrorDetails = Record<string, unknown>;

/**
 * Gateway-shaped error surfaced by every SDK call that talks to the
 * gateway. The `code` field matches the canonical enum in ADR 0003
 * amendment 2026-04-22.
 *
 * `ZeamError` extends the standard `Error` so `instanceof` works; the
 * `message` field is deliberately compact (code + requestId) so partners
 * do not accidentally surface upstream copy to end users. Pass
 * `verboseErrors: true` on the Client to include the gateway's
 * human-readable message.
 */
export class ZeamError extends Error {
  override readonly name = "ZeamError";
  readonly code: string;
  readonly kind: Kind;
  readonly status: number;
  readonly requestId: string;
  readonly upstreamMessage: string;
  readonly details: ErrorDetails | undefined;

  constructor(params: {
    code: string;
    kind: Kind;
    status: number;
    requestId: string;
    upstreamMessage?: string;
    details?: ErrorDetails;
    verbose?: boolean;
  }) {
    const {
      code,
      kind,
      status,
      requestId,
      upstreamMessage = "",
      details,
      verbose = false,
    } = params;
    const base = `zeam: ${code || "error"} (kind=${kind} status=${status} request_id=${requestId})`;
    super(verbose && upstreamMessage ? `${base}: ${upstreamMessage}` : base);
    this.code = code;
    this.kind = kind;
    this.status = status;
    this.requestId = requestId;
    this.upstreamMessage = upstreamMessage;
    this.details = details;
  }

  /**
   * True when the kind matches. Safer than switching on the status.
   */
  is(kind: Kind): boolean {
    return this.kind === kind;
  }
}

/**
 * Thrown by the version handshake when the gateway is older than
 * `MIN_GATEWAY_VERSION`.
 */
export class IncompatibleGatewayError extends Error {
  override readonly name = "IncompatibleGatewayError";
  constructor(
    readonly gatewayVersion: string,
    readonly minVersion: string,
  ) {
    super(`zeam: incompatible gateway ${gatewayVersion} < ${minVersion}`);
  }
}

/**
 * Thrown when a session of the wrong [auth.Track] reaches a typed client.
 */
export class WrongTrackError extends Error {
  override readonly name = "WrongTrackError";
  constructor() {
    super("zeam: session track mismatch (business ↔ connect)");
  }
}
