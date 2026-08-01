// Parent: REQ-1301, REQ-1305
// Flat ESLint config replacing CRA's bundled `react-app` config now that
// react-scripts is gone (see vite.config.ts). Type-aware rules run against
// tsconfig.json so unused-var/no-explicit-any checks match the strict
// compiler settings used across the rest of the codebase.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // aws-lambda/ is the retired legacy backend (kept only for reference, see
    // docs/PROJECT_WALKTHROUGH.md §1); .aws-sam is its generated build output.
    // Neither is part of the live Vite/Express codebase and must not be linted.
    ignores: ["dist", "build", "node_modules", "aws-lambda", "**/.aws-sam/**"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  }
);
