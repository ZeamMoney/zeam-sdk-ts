import { describe, expect, it } from "vitest";
import {
  AutoRefresher,
  KeyringStore,
  MemoryStore,
  Session,
  Track,
  expiryFromExpiresIn,
} from "./index.js";

describe("Session", () => {
  function makeSession(
    overrides?: Partial<{ idToken: string; refreshToken: string; expiresAt: Date }>,
  ) {
    return new Session({
      track: Track.Business,
      idToken: overrides?.idToken ?? "id-1",
      refreshToken: overrides?.refreshToken ?? "rt-1",
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 60_000),
    });
  }

  it("erase() zeros tokens and resets track", () => {
    const sess = makeSession();
    sess.erase();
    expect(sess.idToken).toBe("");
    expect(sess.refreshToken).toBe("");
    expect(sess.track).toBe(Track.Unknown);
    expect(sess.expiresAt.getTime()).toBe(new Date(0).getTime());
  });

  it("update() replaces all three token fields atomically", () => {
    const sess = makeSession();
    const newExpiry = new Date(Date.now() + 3_600_000);
    sess.update("id-new", "rt-new", newExpiry);
    expect(sess.idToken).toBe("id-new");
    expect(sess.refreshToken).toBe("rt-new");
    expect(sess.expiresAt).toBe(newExpiry);
  });

  it("fingerprint is a non-empty string that does not contain the raw token", () => {
    const sess = makeSession({ idToken: "super-secret-token" });
    const fp = sess.fingerprint;
    expect(typeof fp).toBe("string");
    expect(fp.length).toBeGreaterThan(0);
    expect(fp).not.toContain("super-secret-token");
  });
});

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

  it("delete() erases the session and returns undefined on get()", async () => {
    const store = new MemoryStore();
    const sess = new Session({
      track: Track.Business,
      idToken: "id-del",
      refreshToken: "rt-del",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.put(sess);
    await store.delete(Track.Business);
    expect(await store.get(Track.Business)).toBeUndefined();
    expect(sess.idToken).toBe("");
  });

  it("close() erases all sessions", async () => {
    const store = new MemoryStore();
    const biz = new Session({
      track: Track.Business,
      idToken: "biz",
      refreshToken: "rb",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const con = new Session({
      track: Track.Connect,
      idToken: "con",
      refreshToken: "rc",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await store.put(biz);
    await store.put(con);
    await store.close();
    expect(await store.get(Track.Business)).toBeUndefined();
    expect(await store.get(Track.Connect)).toBeUndefined();
    expect(biz.idToken).toBe("");
    expect(con.idToken).toBe("");
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
  it("returns the existing session without calling the refresher when it is still fresh", async () => {
    const store = new MemoryStore();
    const fresh = new Session({
      track: Track.Business,
      idToken: "id-fresh",
      refreshToken: "rt-fresh",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    await store.put(fresh);

    let calls = 0;
    const refresher = {
      async refresh(s: Session) {
        calls++;
        return s;
      },
    };
    const ar = new AutoRefresher(store, refresher, 5 * 60_000);

    const sess = await ar.ensure(Track.Business);
    expect(calls).toBe(0);
    expect(sess.idToken).toBe("id-fresh");
  });

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

describe("KeyringStore", () => {
  it("put() throws (not yet wired)", async () => {
    const store = new KeyringStore("zeam-test");
    const sess = new Session({
      track: Track.Business,
      idToken: "id",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(store.put(sess)).rejects.toThrow();
  });

  it("get() returns undefined (not yet wired)", async () => {
    const store = new KeyringStore("zeam-test");
    expect(await store.get(Track.Business)).toBeUndefined();
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
