import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../../vitest.config.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("coverage source inventory", () => {
  it("includes every source implementation, including runtime index.ts files", () => {
    const coverage = config.test!.coverage!;
    const measured = globSync(coverage.include ?? [], {
      cwd: root,
      exclude: coverage.exclude ?? [],
    });
    const implementations = globSync("src/**/*.ts", {
      cwd: root,
      exclude: ["src/**/*.test.ts"],
    });

    expect(implementations.length).toBeGreaterThan(0);
    expect(measured).toEqual(expect.arrayContaining(implementations));
    expect(measured.some((path) => path.endsWith(".test.ts"))).toBe(false);
  });
});
