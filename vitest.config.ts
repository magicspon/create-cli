import { defineConfig } from 'vitest/config'

// The whole suite is pure node: the tool's I/O is injected, so there is
// nothing here that needs a browser or a DOM.
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
  },
})
