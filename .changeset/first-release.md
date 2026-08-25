---
'@magicspon/create-cli': major
---

First release.

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
