module.exports = {
  extends: ["next/core-web-vitals"],
  env: {
    jest: true,
  },
  rules: {
    "react/no-unescaped-entities": "off",
    "@next/next/no-html-link-for-pages": "off",
  },
};
