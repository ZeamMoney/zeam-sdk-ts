/**
 * A target gateway environment: a human-readable name plus the base URL
 * the SDK will talk to.
 */
export interface Environment {
  readonly name: "production" | "custom";
  readonly baseURL: string;
}

/**
 * Predeclared production environment — https://api-gateway.zeam.app.
 *
 * Sandbox mode does not use a separate URL. Access mode is determined
 * by the credentials and account configuration that Zeam applies to
 * your application, not by the URL you call.
 */
export const Production: Environment = Object.freeze({
  name: "production",
  baseURL: "https://api-gateway.zeam.app",
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
  custom,
} as const;
