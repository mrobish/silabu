// vitest.config.js
// Excludes compiled dist/ to avoid duplicate test runs
export default {
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
