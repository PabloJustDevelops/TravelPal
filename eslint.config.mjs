import reactHooks from "eslint-plugin-react-hooks";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "out/**",
      "build/**",
      "storybook-static/**",
      "next-env.d.ts",
      "jest.config.js",
      "jest.polyfills.js",
      "jest.setup.js",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next ya trae el plugin react-hooks, pero sus reglas viven
    // en un objeto con `files` aparte. Registrarlo aquí permite bajar
    // react-hooks/set-state-in-effect a "warn" sin que ESLint aborte por no
    // encontrar el plugin en este objeto de configuración.
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
