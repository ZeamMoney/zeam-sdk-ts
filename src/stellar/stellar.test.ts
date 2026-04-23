import { describe, expect, it } from "vitest";
import {
  Keypair,
  InvalidPublicKeyError,
  InvalidSeedError,
  mustAsset,
  parseAsset,
  assetString,
  assetsEqual,
  newSigner,
  PublicNetworkPassphrase,
} from "./index.js";

const validPub = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const validSeed = "SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

describe("Keypair", () => {
  it("parses a valid public key", () => {
    const kp = Keypair.parsePublicKey(validPub);
    expect(kp.publicKey).toBe(validPub);
  });

  it("rejects a malformed public key", () => {
    expect(() => Keypair.parsePublicKey("not-a-key")).toThrow(InvalidPublicKeyError);
  });

  it("parses a valid seed and erases on demand", () => {
    const kp = Keypair.parseSeed(validSeed);
    expect(kp.canSign()).toBe(true);
    kp.erase();
    expect(kp.canSign()).toBe(false);
  });

  it("rejects a malformed seed", () => {
    expect(() => Keypair.parseSeed("nope")).toThrow(InvalidSeedError);
  });
});

describe("parseAsset", () => {
  it.each([
    ["XLM", "XLM", true],
    ["native", "XLM", true],
    ["Native", "XLM", true],
    [`USDC:${validPub}`, `USDC:${validPub}`, false],
    [`usdc:${validPub}`, `USDC:${validPub}`, false],
  ])("%s → %s (native=%s)", (input, want, native) => {
    const a = parseAsset(input);
    expect(assetString(a)).toBe(want);
    expect(a.isNative).toBe(native);
  });

  it.each(["USDC", "USDC:not-a-key", `ASDFGHJKLQWE1:${validPub}`])("%s → error", (input) => {
    expect(() => parseAsset(input)).toThrow();
  });
});

describe("assetsEqual", () => {
  it("equates XLM and native", () => {
    expect(assetsEqual(mustAsset("XLM"), mustAsset("native"))).toBe(true);
  });

  it("compares case-insensitively on code", () => {
    expect(assetsEqual(mustAsset(`USDC:${validPub}`), mustAsset(`usdc:${validPub}`))).toBe(true);
  });

  it("distinguishes different assets", () => {
    expect(assetsEqual(mustAsset("XLM"), mustAsset(`USDC:${validPub}`))).toBe(false);
  });
});

describe("placeholder signer", () => {
  it("refuses an empty XDR", async () => {
    const s = newSigner(PublicNetworkPassphrase);
    const kp = Keypair.parseSeed(validSeed);
    await expect(s.sign("", kp)).rejects.toThrow();
  });
});
