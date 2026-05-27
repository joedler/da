import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["gas/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./gas/tsconfig.json"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^(doGet|doPost|testHealth|setupProjectProperties|testReadPeople|testVerifyAndBindStudent|testUnbindTestUser)$"
      }],
      "no-undef": "off"
    }
  }
];
