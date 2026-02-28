// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const expoConfig = require("eslint-config-expo/flat");
const eslintConfigPrettier = require("eslint-config-prettier/flat");

module.exports = defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  ...expoConfig,
  {
    ignores: [
      "dist/*",
      "app-example/**/*",
      "assets/test/**/*",
      "node_modules/**/*",
    ],
  },
  {
    files: ["**/*.cjs", "**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__test-fixtures__/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
