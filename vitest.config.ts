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
      // Floors, not targets — set just under the numbers the suite already
      // reaches, so a real regression fails CI while ordinary work does not
      // have to chase the last percent. Raise them when the suite earns it.
      //
      // Branches sits lower than the other three on purpose. v8 counts every
      // `??` and `?.` as a branch, and the strict-mode guards this codebase is
      // written with cannot all fire: `config.directories[key] ?? '.'` is dead
      // for a registered generator because `resolveConfig` fills an entry for
      // every key the registry uses, `haystack[at - 1] ?? ''` is dead because
      // the `at === 0` test beside it short-circuits first, and `selfAlias`
      // returns `{}` only when this package cannot resolve itself. Reaching
      // those would mean breaking the invariant that makes them dead, which
      // asserts nothing about behaviour. What is left uncovered is that, not
      // untested paths.
      thresholds: {
        statements: 99,
        branches: 94,
        functions: 99,
        lines: 99,
      },
    },
  },
})
