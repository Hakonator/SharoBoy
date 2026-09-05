import js from "@eslint/js"
import ts from "typescript-eslint"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import importPlugin from "eslint-plugin-import"
import prettierConfig from "eslint-config-prettier"

export default ts.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "public/sw.js",
      "scripts/",
      "supabase/",
      "eslint.config.mjs",
      ".husky/",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
    },
    extends: [js.configs.recommended, ...ts.configs.recommended, prettierConfig],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        performance: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        Blob: "readonly",
        Crypto: "readonly",
      },
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/no-deprecated": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "import/order": ["warn", { "newlines-between": "always" }],
      "import/no-unresolved": "off",
      "import/no-unused-modules": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [js.configs.recommended, prettierConfig],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-undef": "off",
    },
  }
)
