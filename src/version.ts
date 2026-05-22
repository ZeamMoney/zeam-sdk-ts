/**
 * Current SDK version. Replaced at release time by the build tooling.
 */
export const VERSION = "0.1.0";

/**
 * Lowest gateway version this SDK is known-good against. The runtime
 * handshake in `Client.ping()` refuses gateways older than this.
 */
export const MIN_GATEWAY_VERSION = "0.1.0";

/**
 * SHA-256 of the OpenAPI spec the SDK was generated from. A compile-time
 * assertion in internal/wire verifies this matches the checked-in spec
 * to prevent silent drift.
 */
export const SPEC_HASH = "91d15af2540264e390be25b3c3a529d5305a8324ceb08d31d2d70573d1395d8c";
