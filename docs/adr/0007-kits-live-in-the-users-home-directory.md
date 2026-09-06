# Kits live in the user's home directory

[ADR 0006](0006-template-files-declare-their-generator.md) made a template file a whole generator,
which means a project's house style is now a directory of files. That directory lives in the
project, and so does everything about it — a second project wanting the same generators copies them.

A **kit** is that same directory, kept in the user's home directory instead:

```
~/.scaffold/
  wibble/
    package.json
    tsconfig.json
    component.ts
    route.ts
```

```bash
npm install -g @magicspon/create-cli
scaffold component Card --kit wibble
```

A kit is a template directory and nothing else. It holds no config file, declares no
`directories`, `imports` or `format`, and its generators resolve their directory keys exactly as a
project's own do — `src/<key>` unless the project's config says otherwise. Whatever a kit is, it is
the same thing `scaffold/templates` already was, in a different place.

## Kits never apply unless they are named

`--kit wibble`, or `kit: 'wibble'` in the project's `scaffold.config.ts`. There is no default kit
and nothing under `~/.scaffold` is loaded because it happens to exist.

The alternative — a conventional `~/.scaffold/default` applied everywhere — was rejected because it
changes what `scaffold component Card` emits in every repository on the machine, with nothing in any
of those repositories saying so. Two people on one team run one command and get different files, and
the diff is the first anyone hears of it. That is the hazard `protect` exists for, one level up.

Discovery means `scaffold kit ls` finds them. It does not mean one applies behind your back.

## A project's own templates win

Generators compose in one order, nearest the project last: built-ins, then the config's
`generators`, then the kit's templates, then the project's own `scaffold/templates`. Each layer
merges field by field over the one beneath, so a repository can adopt a kit whole and override the
single generator that does not fit — with a bare render, exactly as it would override a built-in.

This qualifies ADR 0006's "one conventional path, not a list of candidates", and qualifies it
narrowly. There is still exactly one _conventional_ path, found without being configured. A kit is
an _explicitly named_ one, and 0006 already drew that distinction itself: a configured path is a
promise, a conventional one is a lookup. Everything else in 0006 stands — the filename is the id,
there is no `id` field, an unconfigured directory key resolves under `src`, a missing `fileName`
refuses the run.

## A named kit that is missing or empty refuses the run

"There are no templates" and "there is no such kit" are the same answer only when nobody asked, and
naming a kit is asking. A kit that does not exist, or that exists and holds no template files,
contributes nothing — which is indistinguishable from no kit at all, and would scaffold the built-in
output while looking exactly like success. Both stop the run and list the kits that do exist.

`scaffold/templates` stays silently optional for the same reason it always was: nobody asked for it.

## The kit is parsed out of argv by hand, and then again by citty

`index.ts` loads the config before it defines the command, because the subcommand list _is_ the
registry. A kit contributes generators, so the kit determines the subcommand list — and the kit is
named by a flag, which citty only parses once the subcommands exist. The flag is therefore scanned
out of `process.argv` before anything else happens.

It is _also_ declared on every subcommand, which looks redundant and is not. citty treats an
undeclared flag's value as a positional:

```
scaffold component --kit wibble Card   ->   { kit: true, name: 'wibble' }
```

Without the declaration, that run scaffolds a component called `wibble` and reports success. The
declaration exists to be ignored.

## Templates resolve `@magicspon/create-cli` from the tool, not from themselves

jiti resolves a template's imports from the template's own directory. `~/.scaffold/wibble` has no
`node_modules`, so `import { defineTemplate } from '@magicspon/create-cli'` fails there — and since
`defineTemplate` is the only way to declare a `fileName`, a kit could otherwise never declare a
generator, only override a built-in one. That is the entire feature.

So the loader aliases the package's own name to wherever the running tool resolves it. The same
alias goes to c12 for the project's `scaffold.config.ts`, which had the identical problem and a
larger blast radius: a globally installed `scaffold` could not read a config file that imported
`defineConfig` unless the project _also_ depended on the package locally. Global install was only
ever half true without this.

The alias fixes resolution, not types. A kit gets a `package.json` and a `tsconfig.json` from
`scaffold kit new` so an editor can typecheck it after one install; a project that wants types in
its own config file still adds the devDependency, or writes the config as a plain object, since
every field is optional.

## A new kit is a copy of the built-in core

`scaffold kit new wibble` seeds the kit with `component.ts`, `hook.ts` and `test.ts` — the real
`src/templates` sources, comments and all, with the type import repointed at the package and a
`defineTemplate` default export carrying the generator's config. A kit is a house style, and a house
style starts as an edit of what the tool already emits rather than as an empty directory.

The alternative — one hand-written starter stub — was what shipped first, and it is a second copy of
a template body that nothing keeps in step with the real one. Copying the source means there is no
paraphrase to drift, at the cost of publishing `src/templates` alongside `dist` and of resolving it
from two places at runtime, since this module is a file in development and part of a bundle once
published.

The copied config is spelled out in full rather than left to inherit. A kit is adopted by projects
that never enabled the preset a template came from, and there the filename names no existing
generator — so without a `fileName` of its own the file would refuse the run. (ADR 0006)

**Presets are copied only when named**, by `kit new --preset storybook`. The core assumes nothing
beyond React and a kit applies to every project that adopts it, so seeding `story.ts` unasked would
hand a project with no Storybook a `story` generator — which is exactly what shipping the presets
switched off exists to prevent. (ADR 0003)

## `kit` is a reserved generator id

`scaffold kit new` and `scaffold kit ls` are subcommands, and subcommands are generators. A template
file called `kit.ts` would shadow the management commands or be shadowed by them, and this codebase
has refused every previous version of that question — two templates claiming one id, a template
matching nothing — rather than pick a winner by load order. A generator with that id names the file
and stops.

## Consequences

**`findPackageRoot` no longer throws.** It returns the working directory when there is no
`package.json` anywhere above, so a globally installed `scaffold` works outside a Node project. It
was only ever there to find the package, not to gate the tool.

**`resolveConfig` takes template layers rather than one template record**, applied in order. The
layering is the decision, so it is the shape of the argument.

**`SCAFFOLD_HOME` overrides `~/.scaffold`,** pointing at the kits directory itself in the manner of
`CARGO_HOME` and `PNPM_HOME`. It exists so the tests can point at a temporary directory without
reproducing `homedir()`.

**A run says which kit it used** and nothing more. Threading provenance onto `Generator` so
`--help` could name each generator's source was rejected as a large public surface for a question
`scaffold kit ls` plus one documented precedence rule already answers. It stays available if merge
confusion turns out to be real.

**The package publishes `src/templates` as well as `dist`.** `kit new` copies those files as text,
so they have to be there — and they are read from `../templates` or `../src/templates`, whichever
exists, because this module runs from `src/tool/` in development and from inside `dist/index.mjs`
once published. (ADR 0004)

**A built-in's source is `src/templates/<id>.ts` by convention**, not by a field on `Generator`.
That convention was already the rule for adding an output type (ADR 0001); the copy now depends on
it, so a test asserts every built-in generator has a file of its name.

**Kits declare no compatibility range.** Widening the template context is backwards compatible and
narrowing it is a major version; Changesets already governs that, and a declared range is machinery
for a problem semver has a name for.
