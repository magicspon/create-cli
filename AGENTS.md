# @magicspon/create-cli

A published CLI that scaffolds files from generators a project configures in TypeScript. This repo
is the tool itself — there is no app here.

Read `CONTEXT.md` for the domain language and `docs/adr/` for the decisions before changing
anything structural.

## Grilling

When running the `grilling` skill:

- Ask exactly one question per message, then stop and wait for my answer.
- Present choices as labelled alternatives (`A`, `B`, `C`, …), each on its own line.
- Close with a separate `Recommendation:` line below the alternatives, naming your pick and a one-sentence rationale.

## Architecture in one paragraph

A run resolves to a **plan** — every `{path, contents}` it would write — which is validated in full
before anything lands. `plan.ts` is pure: its only window onto the disk is an injected `exists`
predicate, which is what makes the whole matrix of casing, placement, composition and refusal
testable without a filesystem. The **registry** of generators is built per run from the project's
`scaffold.config.ts`, so a project's own generators are indistinguishable from built-in ones.

```
src/
  index.ts              # the bin: load the config, run the command
  define-config.ts      # the package's public entry — defineConfig + types
  tool/
    cli.ts              # citty subcommands, one per generator, plus `kit`
    config.ts           # c12 config loading; defaults; resolve to a ScaffoldConfig
    generators.ts       # core + presets + the Registry type
    plan.ts             # request -> plan or refusal (pure; the unit under test)
    commit.ts           # the only code that writes; runs configured format commands
    run.ts              # plan/report/write, shared by flags and wizard
    targets.ts          # what a targeted generator can be written against
    directories.ts      # where to write — invents paths that do not exist
    pick.ts             # the target prompt, shared by flags and wizard
    wizard.ts           # the argumentless path
    fuzzy.ts            # path scoring, shared by both pickers
    prompts.ts          # clack helpers — cancel handling, stdin release
    user-templates.ts   # the configured template directory, matched by filename
    testing.ts          # test-only: the temp project, the TTY swap, the clack casts
  templates/            # one file per built-in output type
```

## Rules

- **Adding a built-in output type** is one file in `src/templates/` and one entry in
  `src/tool/generators.ts` — in `core` if it assumes nothing beyond React, in a `presets` group if
  it needs a runner a project may not have. It then appears in `--help`, in the wizard, and — if it
  declares a `target` — in the picker, automatically.
- **A template file is a generator.** `templates/<generator-id>.ts` in the template directory
  (`scaffold/templates` by default, no config needed) overrides the generator of that id field by
  field, or declares one when the id is new. Exporting a bare function overrides `render` and
  nothing else; exporting `defineTemplate(config, render)` overrides whatever the config names. The
  match is on generator id, never on our own template filenames, and the filename is the only place
  an id is written — there is no `id` field. (ADR 0005, ADR 0006)
- **A directory key nothing configures resolves to `src/<key>`**, and a `directory` containing a `/`
  is a path rather than a key. `resolveConfig` fills an entry for every key the registry uses, so
  the `?? '.'` at the lookup sites can no longer fire for a registered generator. (ADR 0006)
- **The registry is per-run, never module-level.** Pass a `Registry` rather than importing one.
  `GeneratorId` is `string`, because a project's own generators cannot be enumerated ahead of time.
- **Config is loaded once, in `index.ts`, before the command is defined.** The subcommand list _is_
  the registry, so it cannot be built any earlier. Do not add a second `loadConfig()` call — the
  project's config file is user code, and running it twice per invocation would make it behave
  differently from how it reads.
- **`index.ts` is the bin and holds nothing else.** Importing it loads a config from the working
  directory and runs a command, so nothing in it can be tested in-process — which is why it is
  excluded from coverage and why the commands live in `tool/cli.ts`. Add a command there.
- **Templates must emit already-formatted, immediately-executable output.** `format` defaults to
  running nothing, and a scaffolded file that fails to typecheck or run on arrival trains people to
  ignore a red run.
- **Templates emit extensionless relative imports.** `./card.tsx` is a type error in any project
  that has not switched on `allowImportingTsExtensions`, which is most of them.
- **`plan.ts` never touches the disk.** Every new refusal goes through the same
  `reject(kind, reason, path)` shape and gets a case in `plan.test.ts`.
- **Nothing may assume shadcn, Tailwind, Storybook or a particular formatter.** Those are all
  project config now. (ADR 0003)
- Try to keep files **under 200 lines** of code (excluding comments).
- **Try/Catch** prefer `attempt` or `attemptAsync` from `es-toolkit`.

## Commands

Package manager is **pnpm**.

| Task             | Command             |
| ---------------- | ------------------- |
| Run from source  | `pnpm scaffold`     |
| Build            | `pnpm build`        |
| Lint             | `pnpm lint`         |
| Format + autofix | `pnpm format`       |
| Check formatting | `pnpm check`        |
| Typecheck        | `pnpm typecheck`    |
| Tests            | `pnpm test`         |
| Link locally     | `pnpm yalc:publish` |

`pnpm scaffold` runs `src/index.ts` on bare Node — the types are stripped, and `.ts` import
specifiers resolve, so there is no build step in development. The **published** package is compiled
by tsdown, because Node refuses to strip types inside `node_modules`. (ADR 0004)

The test suite is one Vitest project, pure node. There is no browser project and no Storybook here.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and
cross-file relationships.

- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json`
  exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for
  focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or
  raw grep output.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review, or when
  query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Doc, image, and config changes are not picked up by `graphify update`. Run `/graphify . --update`
  for those — it re-runs semantic extraction on changed non-code files.
- Graph outputs are derived artifacts. Never hand-edit anything in `graphify-out/`.

## fallow

Static analysis for dead code, duplication, complexity, and dependency hygiene. Config lives in
`.fallowrc.jsonc`.

- **After modifying code, run `fallow audit --format json --quiet --base main`.** Run the full
  `fallow` only for a whole-project audit.
- Append `|| true` to every fallow command. Exit code 1 means "issues found", not a failure; only
  exit 2 is a real error.
- Before deleting anything fallow reports as unused, confirm it with `fallow dead-code --trace
FILE:EXPORT`, `--trace-file PATH`, or `--trace-dependency PKG`. Fallow is syntactic, so an export
  can be imported-but-unreferenced and a dependency can be loaded by config rather than by import.
- CI runs the same gate on every PR into `main` (`.github/workflows/fallow.yml`), using
  `--gate new-only` so only findings the PR _introduces_ fail the build. The fallow version there
  is pinned — bump it deliberately.

## Publishing

Changesets drives it. `.github/workflows/release.yaml` builds and runs `pnpm release` on a push to
`main`. Add a changeset with `pnpm changeset` for anything user-visible.

The public surface is exactly two things: the `scaffold` binary and the `defineConfig` export.
Widening `exports` is a deliberate decision, not a convenience — everything under `tool/` is
internal and free to change.

## Conventions

- **Import alias:** none. This package is small and relative imports keep it runnable on bare Node
  without a resolver.
- **TypeScript is strict**, with `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`,
  `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax` all on. The registry and the directory
  map are string-keyed lookups over user-supplied keys, so an index access really can miss — keep
  the `??` guards.
- **Formatting** is Oxfmt, then `oxlint --fix`. Run `pnpm format` before committing.

## Comments

- Always comment your code (unless it's very obvious).
- Explain **why**, not what. The code shows what.
- Reference ADRs where a decision is load-bearing: `(ADR 0003)`.
- `// TODO(WP-xxx):` for known incomplete work.
- JSDoc on all exported functions and types.
- Try to keep comments as short as possible, a single paragraph should be enough.

## Communication

Always respond to the user in plain language using ISO 24495-1:2023.
