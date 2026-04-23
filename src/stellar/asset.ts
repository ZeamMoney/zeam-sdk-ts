const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const ASSET_CODE_RE = /^[A-Z0-9]{1,12}$/;

/** Thrown by {@link parseAsset} when the input is malformed. */
export class InvalidAssetError extends Error {
  override readonly name = "InvalidAssetError";
  constructor(reason: string) {
    super(`stellar: invalid asset (${reason})`);
  }
}

/**
 * Asset is the normalised form of a Stellar asset, aligned with the
 * gateway's validation rules. "XLM" and "native" are equivalent.
 */
export interface Asset {
  readonly code: string;
  readonly issuer: string;
  /** True when this represents native XLM. */
  readonly isNative: boolean;
}

/**
 * Parse a gateway-formatted asset string. "XLM" and "native" are both
 * accepted (case-insensitive) and canonicalise to IsNative=true.
 * Otherwise "CODE:ISSUER" with a 1-12 char code (upper-cased) and a
 * valid G... issuer.
 */
export function parseAsset(s: string): Asset {
  const trimmed = s.trim();
  if (!trimmed) throw new InvalidAssetError("empty");
  const lower = trimmed.toLowerCase();
  if (lower === "xlm" || lower === "native") {
    return Object.freeze({ code: "XLM", issuer: "", isNative: true });
  }
  const idx = trimmed.indexOf(":");
  if (idx < 0) throw new InvalidAssetError("expected XLM/native or CODE:ISSUER");
  const code = trimmed.slice(0, idx).toUpperCase();
  const issuer = trimmed.slice(idx + 1);
  if (!ASSET_CODE_RE.test(code)) {
    throw new InvalidAssetError(`code ${JSON.stringify(code)} is not 1-12 alphanumerics`);
  }
  if (!PUBLIC_KEY_RE.test(issuer)) {
    throw new InvalidAssetError(`issuer ${JSON.stringify(issuer)} is not a Stellar public key`);
  }
  return Object.freeze({ code, issuer, isNative: false });
}

/** Panic-on-error variant — convenient in tests and top-level scripts. */
export function mustAsset(s: string): Asset {
  return parseAsset(s);
}

/** Canonical wire representation: "XLM" for native, "CODE:ISSUER" otherwise. */
export function assetString(a: Asset): string {
  return a.isNative ? "XLM" : `${a.code}:${a.issuer}`;
}

/** Compare two assets after normalisation. */
export function assetsEqual(a: Asset, b: Asset): boolean {
  if (a.isNative && b.isNative) return true;
  return a.code === b.code && a.issuer === b.issuer;
}
