import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/auth/index.ts",
    "src/stellar/index.ts",
    "src/recipes/index.ts",
    "src/webhook/index.ts",
    "src/client/application/index.ts",
    "src/client/business/index.ts",
    "src/client/connect/index.ts",
    "src/client/health/index.ts",
    "src/client/payments/index.ts",
    "src/client/reports/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "node22",
  outDir: "dist",
});
