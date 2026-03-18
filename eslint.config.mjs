import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: ["dist/**"],
  },
  ...nextVitals,
];

export default config;
