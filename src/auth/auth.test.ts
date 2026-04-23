import { describe, expect, it } from "vitest";
import { AutoRefresher, MemoryStore, Session, Track, expiryFromExpiresIn } from "./index.js";

describe("MemoryStore", () => {
  it("persists and retrieves by track", async () => {
    const store = new MemoryStore();
    const sess = new Session({
      track: Track.Business,
      idToken: "id-1",
      refreshToken: "rt-1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.put(sess);
    const got = await store.get(Track.Business);
    expect(got?.idToken).toBe("id-1");
  });

  it("refuses unknown-track sessions", async () => {
    const store = new MemoryStore();
    const bad = new Session({
      track: Track.Unknown,
      idToken: "x",
      refreshToken: "y",
      expiresAt: new Date(),
    });
    await expect(store.put(bad)).rejects.toThrow();
  });

  it("erases replaced sessions", async () => {
    const store = new MemoryStore();
    const first = new Session({
      track: Track.Business,
      idToken: "first",
      refreshToken: "r1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.put(first);
    const second = new Session({
      track: Track.Business,
      idToken: "second",
      refreshToken: "r2",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.put(second);
    expect(first.idToken).toBe("");
    expect((await store.get(Track.Business))?.idToken).toBe("second");
  });
});

describe("Session.needsRefresh", () => {
  it("detects expiry within the threshold", () => {
    const now = new Date();
    const soon = new Session({
      track: Track.Business,
      idToken: "id",
      refreshToken: "rt",
      expiresAt: new Date(now.getTime() + 30_000),
    });
    expect(soon.needsRefresh(now, 60_000)).toBe(true);

    const later = new Session({
      track: Track.Business,
      idToken: "id",
      refreshToken: "rt",
      expiresAt: new Date(now.getTime() + 600_000),
    });
    expect(later.needsRefresh(now, 60_000)).toBe(false);
  });
});

describe("AutoRefresher", () => {
  it("single-flights concurrent refreshers", async () => {
    const store = new MemoryStore();
    const stale = new Session({
      track: Track.Business,
      idToken: "id-old",
      refreshToken: "rt-old",
      expiresAt: new Date(Date.now() - 1_000),
    });
    await store.put(stale);

    let calls = 0;
    const refresher = {
      async refresh(sess: Session): Promise<Session> {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        sess.update("id-new", "rt-new", new Date(Date.now() + 60_000));
        return sess;
      },
    };
    const ar = new AutoRefresher(store, refresher, 5 * 60_000);

    const all = await Promise.all(Array.from({ length: 5 }, () => ar.ensure(Track.Business)));
    expect(calls).toBe(1);
    for (const sess of all) expect(sess.idToken).toBe("id-new");
  });
});

describe("expiryFromExpiresIn", () => {
  it("accepts a numeric string", () => {
    const d = expiryFromExpiresIn("3600");
    expect(d.getTime()).toBeGreaterThan(Date.now() + 30 * 60_000);
  });

  it("rejects empty / non-positive inputs", () => {
    expect(() => expiryFromExpiresIn("")).toThrow();
    expect(() => expiryFromExpiresIn("abc")).toThrow();
    expect(() => expiryFromExpiresIn("0")).toThrow();
  });
});
