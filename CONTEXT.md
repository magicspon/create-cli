# Context: @magicspon/create-cli

The domain model for this project — the words we use, what they mean, and the rules that must hold.

Agents read this before exploring the codebase (see `docs/agents/domain.md`). It is filled in
lazily: terms land here when a decision actually resolves them, not upfront. An empty section means
nothing has been pinned down yet, which is fine.

## Glossary

<!-- One entry per domain term. Definition first, then any synonyms we deliberately avoid. -->

### Scaffolding

**Generator**:
A named recipe that turns a name and a directory into exactly one file. `component`, `hook` and
`story` are generators.
_Avoid_: template (that's one part of a generator), blueprint, schematic

**Output type**:
The kind of file a generator produces. One generator, one output type — they are the same axis
named from different ends.

**Target**:
The existing file a generator writes _against_, as opposed to the file it writes. `story` has one:
the component it is a story for. Resolved by co-location, never by inspecting the file.

**Template**:
The TypeScript function inside a generator that turns a template context into file contents. Not a
file in a template language, and not necessarily ours — a project supplies its own. (ADR 0002,
ADR 0003)

**Template directory**:
`scaffold/templates` unless a project points `templates` somewhere else. Each file is named after
the generator it overrides — `component.ts` overrides `component` — or, when it names no existing
generator, declares one. A file prefixed `_` is a helper rather than a template. (ADR 0005,
ADR 0006)

**Kit**:
A template directory in the user's home directory rather than in a project, so one set of
generators can serve every repository on the machine. `~/.scaffold/wibble`, named as
`--kit wibble`. A kit holds templates and nothing else — no config file — and never applies unless
it is named. (ADR 0007)
_Avoid_: project (that is the repository being scaffolded into), profile, preset (a preset is a
built-in generator group)

**Kits directory**:
`~/.scaffold`, or whatever `SCAFFOLD_HOME` names. Each directory directly inside it is one kit.
(ADR 0007)

**Declaration**:
What a template file says about its generator besides the render — `description`, `directory`,
`fileName`, `target`. Never an `id`: the filename is the id. A file that declares nothing is the
render-only override. (ADR 0006)

**Directory key**:
A generator's `directory`. A plain word is a key into the config's `directories` and resolves to
`src/<key>` when nothing configures it; a value containing a `/` is already a path. (ADR 0006)

**Template context**:
The values a template may use — the name in every casing it needs, the resolved paths, and the
project's configured `imports`. The only input a template gets.

**Plan**:
The full set of `{path, contents}` a run would write, resolved and validated before anything is
written. What `--dry-run` prints and what a real run commits.

**Registry**:
The generators one run resolved to: the core, plus enabled presets, plus the project's own. Built
per run from the config, not a module-level constant. Note this is _our_ registry — unrelated to a
component registry like shadcn's.

**Core**:
The generators that are always on and assume nothing beyond React — `component`, `hook`, `test`.

**Preset**:
A named group of built-in generators that stays off until a project asks for it, because it emits
files that need a runner the project may not have. `storybook`, `browser`, `msw`.

**Protected directory**:
A directory listed in `protect` that no generator may write into, because another tool owns it and
will overwrite it — `src/components/ui` under shadcn, say. Empty by default.

## Invariants

<!-- Rules that must always hold. If code can violate one, it's a bug. -->

- A generator never reads its target's contents. Given the same name and directory it produces the
  same bytes.
- A run is all-or-nothing. If any file in the plan would overwrite an existing file, nothing is
  written and the run exits non-zero.
- Generated files never land in a protected directory, even under `--force`.
- The tool works with no config file at all. Every setting has a default that scaffolds something
  sensible.
- A project's own generators are indistinguishable from built-in ones once registered — same
  `--help`, same `--with`, same wizard.
- A file in the template directory either overrides a generator or declares one. A file that does
  neither — no matching generator and no `fileName` to declare one with — refuses the run.
  Scaffolding the built-in output instead would look exactly like success.
- A generator never writes to the project root by accident. Every directory key the registry uses
  resolves to a path, configured or `src/<key>`.
- A kit applies only when it is named, by `--kit` or by `kit` in the config. Nothing under the kits
  directory is loaded because it happens to exist.
- A named kit that is missing, or that holds no template files, refuses the run and lists the kits
  that exist. Contributing nothing is indistinguishable from no kit at all.
- A project's own templates win over a kit's, field by field — so a repository can adopt a kit
  whole and override the one generator that does not fit.
- `kit` is not an available generator id. It names the management subcommand, and a generator would
  shadow it.
- A new kit starts as a copy of the built-in core templates, and of a preset's only when
  `kit new --preset` names it. A kit applies to every project that adopts it, so a preset template
  nobody asked for would give a project a generator for a runner it does not have.

## Boundaries

<!-- Where this system stops, and what it hands off to. -->

- The scaffolder writes files and stops. Formatting is handed to whatever commands the project
  configures; correctness is handed to the project's typechecker and linter; the contents of a
  story's args or a test's cases are left to whoever opens the file.
- It never generates a file the project cannot execute. That is why the generators needing a
  particular runner live in presets rather than in the core.
- Templates emit already-formatted output, because `format` defaults to running nothing.
- A kit carries templates, not settings. `directories`, `imports`, `format` and `protect` belong to
  the project being scaffolded into, so a kit's generators resolve against that project's config
  exactly as the project's own generators do. (ADR 0007)

## Decisions

Architectural decisions live as ADRs in `docs/adr/`.
