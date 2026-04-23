import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "test/unit/**/*.test.ts"],
    exclude: ["test/contract/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/internal/wire/**"],
    },
  },
});
