import { defineConfig } from 'tsdown'

/**
 * Two entries, because the package is two things: the `scaffold` binary and the
 * `defineConfig` a project imports to write its config file.
 *
 * Node refuses to strip types inside `node_modules`, so a published `.ts` file
 * is unloadable however modern the runtime — the build is not an optimisation,
 * it is what makes the package importable at all. (ADR 0004)
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/define-config.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node26',
  // Types ship because `defineConfig` is only worth importing for them — and
  // only for that entry, because nothing imports the binary, so a `.d.mts`
  // beside it is an empty file the package would ship forever.
  dts: { entry: ['src/define-config.ts'] },
  clean: true,
  // Runtime deps are resolved from the consumer's node_modules rather than
  // inlined; bundling them would ship a second copy of each per install.
  deps: {
    neverBundle: ['@clack/prompts', 'c12', 'citty', 'es-toolkit'],
  },
})
