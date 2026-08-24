# Generators emit one file, composed rather than bundled

A scaffolder for React work naturally suggests a `component` generator that emits a component plus
an optional story and test, driven by `--story` / `--test` flags. We went the other way: `component`,
`hook` and `story` each emit exactly one file, and `component --with story` runs two generators.

The deciding case is retrofitting. Adding a story to a component that already exists is the common
operation once a repo has more than a handful of components, and under a bundled `component`
generator it is a second code path that duplicates the story-writing logic. Under composition it is
the same generator with a different target, and the bundled case is the one that costs nothing
extra.

The other reason is extensibility. "Add a new output type" reduces to "write one generator and add
one import", with no opt-in flag plumbing to thread through an existing generator.

## Consequences

A generator that writes _against_ an existing file needs a **target**, a concept the bundled design
never needs. Co-location resolves it without a new input: `story Card src/components` means the
story for `src/components/card.tsx`, written beside it.

Composition plus all-or-nothing writes forces a plan/commit split — the runner resolves every
generator to `{path, contents}`, validates the whole set, then writes. Existence checks run against
files on disk _plus_ files already in the plan, so `component --with story` works even though the
component does not exist when the story generator runs. `--dry-run` is then the same code path
stopping one step early.
