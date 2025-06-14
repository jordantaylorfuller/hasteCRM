module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', '.next/', 'coverage/', '*.js'],
  parserOptions: {
    ecmaVersion: 2020,
  },
  env: {
    node: true,
    es6: true,
  },
  extends: ['eslint:recommended'],
};