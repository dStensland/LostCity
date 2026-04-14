import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const localRules = require("./tools/eslint-rules/index.js");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore built/minified files in public directory
    "public/**",
    // ESLint tooling — CJS Node.js files, not application source
    "tools/**",
  ]),
  // Enforce three-layer contract: retrievers may not issue their own DB calls.
  // See spec §2.5 and web/tools/eslint-rules/no-retriever-rpc-calls.js.
  {
    files: ["lib/search/retrievers/**/*.{ts,tsx,js}"],
    plugins: { local: localRules },
    rules: {
      "local/no-retriever-rpc-calls": "error",
    },
  },
]);

export default eslintConfig;
