// @ts-check
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "examples/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        crypto: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "off",
      // The SDK uses the `const X = {...}; type X = ...` pattern to expose
      // both a namespace-style value and a type with the same name. The
      // core `no-redeclare` rule cannot see TypeScript type declarations.
      "no-redeclare": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.cjs", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
];
