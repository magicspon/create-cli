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
      // `index.ts` is the bin and nothing else: importing it loads a config
      // from the working directory and runs a command, so it cannot be
      // exercised in-process. Everything it used to hold now lives in
      // `tool/cli.ts`, which is covered.
      exclude: ['dist', 'src/index.ts'],
      // `lcovonly` rather than `lcov`: the latter writes a second HTML report
      // under `coverage/lcov-report`, which `html` has already produced.
      reporter: ['text', 'html', 'lcovonly'],
      // The suite covers every statement, branch, function and line, so the
      // floor is the number itself: anything less is a path someone added and
      // did not test.
      //
      // The handful of guards that cannot fire are marked `/* v8 ignore next */`
      // at the site, each one a `??` or `||` that `noUncheckedIndexedAccess`
      // asks for on an index that is provably in range. Reaching them would
      // mean breaking the invariant that makes them dead, which asserts
      // nothing about behaviour — so they are excluded by name rather than
      // hidden inside a lowered threshold.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
