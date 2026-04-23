/**
 * A target gateway environment: a human-readable name plus the base URL
 * the SDK will talk to.
 */
export interface Environment {
  readonly name: "production" | "staging" | "sandbox" | "custom";
  readonly baseURL: string;
}

/**
 * Predeclared production environment — https://api.zeam.app.
 */
export const Production: Environment = Object.freeze({
  name: "production",
  baseURL: "https://api.zeam.app",
});

/**
 * Predeclared staging environment — https://api.staging.zeam.app.
 */
export const Staging: Environment = Object.freeze({
  name: "staging",
  baseURL: "https://api.staging.zeam.app",
});

/**
 * Predeclared sandbox environment — https://api.sandbox.zeam.app.
 */
export const Sandbox: Environment = Object.freeze({
  name: "sandbox",
  baseURL: "https://api.sandbox.zeam.app",
});

/**
 * Declare a custom environment (e.g. http://localhost:8080 for local
 * development).
 *
 * Plain-HTTP base URLs are only accepted when `insecureTransport: true`
 * is passed to the Client AND the `ZEAM_SDK_ALLOW_INSECURE=1` environment
 * variable is set.
 */
export function custom(baseURL: string): Environment {
  return Object.freeze({ name: "custom", baseURL });
}

/**
 * Convenience namespace so callers can write `Environment.Production`.
 */
export const Environment = {
  Production,
  Staging,
  Sandbox,
  custom,
} as const;
