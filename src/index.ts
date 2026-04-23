/**
 * Official TypeScript SDK for the Zeam Platform API Gateway. Server-side
 * only (Node 22+, Deno, Bun). See README and SECURITY for details.
 */
export { Client, RawClient, type ClientOptions, type Doer } from "./client.js";
export {
  Environment,
  Production,
  Staging,
  Sandbox,
  custom as customEnvironment,
} from "./environment.js";
export {
  ZeamError,
  IncompatibleGatewayError,
  WrongTrackError,
  Kind,
  kindFromStatus,
  type ErrorDetails,
} from "./errors.js";
export { VERSION, MIN_GATEWAY_VERSION, SPEC_HASH } from "./version.js";
