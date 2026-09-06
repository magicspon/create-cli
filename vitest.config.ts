import { defineConfig } from 'vitest/config'

// The whole suite is pure node: the tool's I/O is injected, so there is
// nothing here that needs a browser or a DOM.
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],

    coverage: {
      // Every source file, not only the ones a test happened to import — an
      // untested file reading 0% is the number worth seeing.
      include: ['src/**/*.ts'],
      exclude: ['dist'],
      // `lcovonly` rather than `lcov`: the latter writes a second HTML report
      // under `coverage/lcov-report`, which `html` has already produced.
      reporter: ['text', 'html', 'lcovonly'],
      // Floors, not targets — set just under the numbers the suite already
      // reaches, so a real regression fails CI while ordinary work does not
      // have to chase the last percent. Raise them when the suite earns it.
      //
      // Branches sits lower than the other three on purpose. v8 counts every
      // `??`, `?.` and defensive `catch` as a branch, and this codebase is
      // written with a lot of them — `result ?? []` in a renderer an error
      // envelope never reaches, `if (!sf) continue` inside the adapter, a guard
      // against a store row that cannot exist. Reaching those would mean
      // corrupting a store or mocking the type checker, which asserts nothing
      // about behaviour. What is left uncovered is that, not untested paths.
      thresholds: {
        statements: 97,
        branches: 90,
        functions: 98,
        lines: 98,
      },
    },
  },
})
