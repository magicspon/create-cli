# Generators come from the project's config, not from the package

The scaffolder began as project-local tooling: the generator registry was a literal array in the
source, and default directories were read from shadcn's `components.json`. Publishing it to npm
breaks both. A registry compiled into the package cannot be extended by the project installing it,
and reading `components.json` makes the tool unusable in any project that does not use shadcn.

ADR 0002 named this exact moment as the thing to revisit: "Templates cannot be edited without
recompiling, which rules out user-supplied templates. That is fine while this is a project-local
scaffolder; it is the thing to revisit if it is ever extracted into a published package."

So the registry is now resolved per run, from a `scaffold.config.ts` loaded with
[c12](https://github.com/unjs/c12):

- **A neutral core** — `component`, `hook`, `test` — always on. Nothing in it assumes a styling
  library, a story format, or a test runner beyond Vitest.
- **Presets** — `storybook`, `browser`, `msw` — off unless named. These generate files that only
  make sense once the project has the runner behind them, so shipping them switched on would
  scaffold files most projects cannot execute.
- **User generators**, supplied by the config file, which are registered exactly like built-ins.

## Templates stay TypeScript functions

ADR 0002's reasoning survives intact, and this is what makes that possible: c12 loads a `.ts`
config through jiti, so a user's `render` is a typechecked TypeScript function in their own
project, not a string in a template language. `defineConfig` is exported purely so that function
is typed against `TemplateContext` without the author annotating anything.

What changes is only _where_ the function lives. Nothing about templates became stringly-typed.

## Consequences

**The registry is per-run, not module-level.** `plan()`, the pickers and the wizard all take a
`Registry` rather than importing one, and `GeneratorId` is `string` rather than a closed union —
a project's own generators are as real as the built-in ones, so nothing can enumerate them ahead
of time. This is why the config is loaded before the citty command is defined: the subcommand list
_is_ the registry.

**A user generator reusing a built-in id replaces it in place.** That is how a project keeps
`component` in `--with` and in the wizard while emitting its own house style, rather than having
to disable one id and introduce a second.

**Two rules that were about shadcn became general.** The registry-owned directory is now a
`protect` list of directories any tool may own, defaulting to empty; and formatting is a `format`
list of commands rather than a hard-coded `oxfmt`, defaulting to none. Both had been facts about
one project's toolchain masquerading as facts about scaffolding. Because `format` now defaults to
doing nothing, every template must emit already-formatted output.

**Default directories are conventional rather than discovered.** `src/components`, `src/hooks`,
`src/lib`, overridable per key. The old guarantee that the scaffolder and the shadcn CLI could not
disagree is gone; a shadcn project restores it by naming the same paths in one config file.
