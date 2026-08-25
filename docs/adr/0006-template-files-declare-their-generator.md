# Template files declare their own generator

[ADR 0005](0005-template-files-are-matched-by-filename.md) let a project keep its templates in a
directory and match them to generators by filename, but it drew the line at `render`: a template
file could replace what a generator emits and nothing else. Anything with its own `fileName` or
`directory` still had to be declared in full in `generators`.

That line put the copy-and-drift problem back one level up. A project adding a `route` generator
wrote it out in `scaffold.config.ts` — id, description, directory, `fileName`, render — and if it
then wanted the render in its own file, it wrote the id twice, in two files, and kept them in step
by hand.

So a template file now declares whatever it wants of its generator, alongside its render:

```ts
// scaffold/templates/route.ts
import { defineTemplate } from '@magicspon/create-cli'

export default defineTemplate(
  {
    description: 'A route module',
    directory: 'routes',
    fileName: ({ kebabName }) => `${kebabName}.route.ts`,
  },
  ({ kebabName, pascalName }) =>
    `export const ${pascalName}Route = {\n  path: '/${kebabName}',\n}\n`,
)
```

A file whose name matches an existing generator overrides that generator, field by field — so
ADR 0005's render-only form is unchanged, and is still what most template files are. A file whose
name matches nothing declares a generator, which then appears in `--help`, in `--with` and in the
wizard like any other.

## The filename is still the only id

`defineTemplate` takes no `id`. It was the obvious field to offer and it is the one that had to be
refused: ADR 0005 rejected a map in the config because a second place to register a thing is a
second place to forget, and an `id` inside the file is that same second place wearing a different
hat. A file called `my-route.ts` declaring `id: 'route'` would have to answer which of the two names
the generator has, and no answer to that is better than not being able to ask.

Renaming a generator is renaming a file.

## What still catches a typo

ADR 0005's strongest rule was that `componant.ts` refuses the run, because a template silently
skipped scaffolds the built-in output and looks exactly like success. Discovery appears to give that
up: a filename matching nothing is no longer an orphan, it is a new generator.

It survives for a different reason. A generator needs a `fileName`, and there is no honest default
for one — so `componant.ts`, which is a render and nothing else, has no `fileName` and no `componant`
generator to inherit one from. The run stops and names what was available, exactly as before. What
changed is the sentence, not the guarantee.

A leading `_` is still the escape hatch for a file that is not a template at all.

## A directory key nothing configures resolves under `src`

`directory` is a key into the config's `directories`, and an unconfigured key used to fall back to
the project root. That was defensible while every generator came from a config file that could name
the key too. It is not defensible now: a generator declared in a template file has no config entry
by design, so `directory: 'routes'` would have scaffolded `home.route.ts` into the repository root —
zero config in name only.

An unconfigured key now resolves to `src/<key>`. This is not a new convention. It is the rule the
default table was already spelling out one line at a time:

```
components -> src/components
hooks      -> src/hooks
lib        -> src/lib
routes     -> src/routes    <- falls out of the same rule
```

A `directory` containing a `/` is read as a path rather than a key, so `app/routes` means
`app/routes` and never `src/app/routes`. A project that wants somewhere else still says so in
`directories`, which continues to win over both.

## `scaffold/templates` is found without being configured

`templates` no longer has to be set. If `scaffold/templates` exists it is used; if it does not,
there are no user templates and nothing is said. A project's first generator is therefore one file
and no config file at all, which is the whole point of the change.

A directory a project _did_ configure still refuses the run when it is missing, as ADR 0005 had it.
The two are not inconsistent: a configured path is a promise, and a conventional one is a lookup.
"There are no templates" and "there is no such directory" are the same answer only when nobody
asked.

One conventional path, not a list of candidates. Which of several won would be a rule to learn, and
not having a rule to learn is what this is for.

## Consequences

**`generators` in the config is no longer the only way to add one, and rarely the best.** It stays,
and it is still the right home for a generator built programmatically or shared from a package —
but the ordinary case is a file. The two compose as they did: `templates` is applied last, over the
composed list, so a file wins over a config entry of the same id.

**`defineTemplate` gained an overload rather than a second function.** `defineTemplate(render)` and
`defineTemplate(config, render)` are the same idea at two levels of detail, and the render stays the
last argument in both — so the template body, which is the long part, is never buried inside an
object literal.

**A template's `target` is validated.** A declared generator can name a target, and a target naming
nothing is refused after the whole directory is composed — so one template may target a generator
another template declared, whatever order they load in.

**`TemplateMeta` joins the public surface**, and the fields it merges are listed by hand in
`applyTemplates`. Spreading it wholesale would overwrite a built-in's description with `undefined`
for every field a file left out, which is the exact opposite of inheriting it.
