# @magicspon/create-cli

## 1.1.0

### Minor Changes

- [#15](https://github.com/magicspon/create-cli/pull/15) [`d7922ab`](https://github.com/magicspon/create-cli/commit/d7922abd6b07c707daf2f37b0b4aae8687a5bcc3) Thanks [@magicspon](https://github.com/magicspon)! - Add **kits**: template directories in `~/.scaffold` rather than in a project, so one set of
  generators can serve every repository on your machine.

  ```bash
  npm install -g @magicspon/create-cli
  scaffold kit new wibble
  scaffold component Card --kit wibble
  ```

  A kit is a template directory and nothing else — the same files and the same rules as
  `scaffold/templates`, somewhere else. Name one with `--kit`, or with `kit` in
  `scaffold.config.ts`; nothing under `~/.scaffold` applies unless it is named. A project's own
  templates layer over a kit's field by field, so a repository can adopt a kit whole and override the
  one generator that does not fit. `scaffold kit new` and `scaffold kit ls` manage them, and
  `SCAFFOLD_HOME` overrides the location. (ADR 0007)

  Two fixes that global installation needed:

  - `scaffold` no longer requires a `package.json` above the working directory. It falls back to that
    directory, so it works outside a Node project.
  - A `scaffold.config.ts` that imports `defineConfig` now loads under a global install. The tool
    resolves its own package from where the tool is installed rather than from the file being
    loaded, so a project no longer needs a local dependency for its config file to work.

  `kit` is now a reserved generator id, since `scaffold kit` is a subcommand and subcommands are
  generators. A generator of that id refuses the run and names the file.

## 1.0.0

### Major Changes

- [`093b62f`](https://github.com/magicspon/create-cli/commit/093b62f275ccdd6d2c48cbf9de3286523303254e) Thanks [@magicspon](https://github.com/magicspon)! - First release.

  A CLI that scaffolds files from generators your project configures in TypeScript — typechecked
  functions rather than a template language. It works with no config file at all, and every part of it
  is replaceable.

  **Works immediately.** `component`, `hook` and `test` assume nothing beyond React, so
  `scaffold component DataTable` writes `src/components/data-table.tsx` on a fresh install. Names are
  accepted in any casing — `DataTable`, `data table` and `data_table` all reach the same file.

  **One generator, one file.** A component with a story is composition (`--with story`), not a special
  mode, which is why retrofitting a story onto a component you wrote weeks ago runs the same code path
  as generating both at once.

  **Nothing is ever half-written.** A run resolves to a plan — every path and its contents — validated
  in full before anything lands. If any part is refused, the whole run is refused, the offending path
  is named, and the exit code is non-zero. `--dry-run` is that same path stopped one stage early, so
  what you inspect and what a real run commits cannot drift apart.

  **Argumentless or non-interactive.** Run it bare and it prompts; run it with a name and it asks
  nothing, so an agent drives the same tool a person does. Target and directory pickers match on a
  subsequence, so `dtab` finds `data-table.tsx`. In a pipe with no terminal it refuses rather than
  hanging.

  **Presets stay off until you ask.** `storybook`, `browser` and `msw` each emit files that import a
  runner your project may not have, so switching one on is a decision rather than a default. A preset
  name nothing registers is an error, not a silent no-op.

  **Your own generators are indistinguishable from the built-ins.** Declare them in
  `scaffold.config.ts`, or drop a file into `scaffold/templates` named after the generator it declares
  or overrides — discovered with no config, and appearing in `--help`, the wizard and the picker
  automatically. `defineConfig` and `defineTemplate` are exported for typing both.

  **Configured, not assumed.** `directories`, `disable`, `imports`, `protect` (directories another tool
  owns, refused even under `--force`) and `format` (commands run over what a run wrote). All optional,
  all defaulting to something that works untouched.

  Ships compiled JavaScript and requires Node 20.19+, because Node refuses to strip types inside
  `node_modules`. The public surface is exactly the `scaffold` binary and the `defineConfig` export.
