import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      // Demote React 19 compiler-specific experimental rules to warnings for React 18
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-page-custom-font": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "functions/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];
