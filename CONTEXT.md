# Context: @magicspon/scaffold

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

## Boundaries

<!-- Where this system stops, and what it hands off to. -->

- The scaffolder writes files and stops. Formatting is handed to whatever commands the project
  configures; correctness is handed to the project's typechecker and linter; the contents of a
  story's args or a test's cases are left to whoever opens the file.
- It never generates a file the project cannot execute. That is why the generators needing a
  particular runner live in presets rather than in the core.
- Templates emit already-formatted output, because `format` defaults to running nothing.

## Decisions

Architectural decisions live as ADRs in `docs/adr/`.
