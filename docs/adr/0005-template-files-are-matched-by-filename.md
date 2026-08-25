# Template files are matched to generators by filename

> Extended by [ADR 0006](0006-template-files-declare-their-generator.md): a template file may now
> declare the rest of its generator too, and one naming no existing generator declares a new one.
> The filename is still the id, and the render-only form below is unchanged.

[ADR 0003](0003-generators-come-from-config.md) gave a project one way to emit its own house style:
declare a generator in `scaffold.config.ts` reusing a built-in's id. That works, and it stays. But
to change the one function it actually cared about, a project had to restate the rest of the
generator too:

```ts
generators: [
  {
    id: 'component',
    description: 'A component in our house style', // restated
    directory: 'components', // restated
    fileName: ({ kebabName }) => `${kebabName}.tsx`, // restated
    render: myRender, // the only line that was the point
  },
]
```

Three of those four lines are a copy of the built-in, and a copy that silently drifts: a built-in
whose `fileName` changes leaves every project that restated it emitting the old name.

So a project may instead name a **template directory**, and a file in it whose basename matches a
generator id replaces that generator's `render` and nothing else:

```ts
export default defineConfig({ templates: 'scaffold/templates' })
```

```
scaffold/templates/component.ts   -> replaces the `component` generator's render
scaffold/templates/hook-test.ts   -> replaces `hook-test`'s
scaffold/templates/_banner.ts     -> not a template; a helper the others import
```

## Why the filename, and not a map in the config

An explicit `{ component: './scaffold/component.ts' }` map was the alternative. It was rejected for
the reason the subcommand list is the registry: a second place to register a thing is a second place
to forget. Under the convention, adding a template is adding a file, and the file's name is the
whole declaration.

The matching key is the **generator id**, not our own template filenames. They happen to coincide
today — `src/templates/component.ts` backs the `component` generator — and that is a coincidence
worth not depending on. A generator a project defined itself in `generators` is overridable by
`templates/route.ts` exactly like a built-in, which would be incoherent if the key were a filename
inside this package.

## A template that matches nothing is an error

The same reasoning as an unknown preset name, and stronger. `templates/componant.ts` skipped
silently does not fail — it scaffolds, with the built-in template, which is the one failure mode a
scaffolder cannot afford: the file lands, it is just the wrong file, and it lands looking exactly
like a success.

A leading `_` is the escape hatch, so a template directory can still hold the helpers its templates
import. That is the only way to keep a non-template file there, which is the point.

## Consequences

**`render` is the only thing a template file can replace.** A project wanting a different filename,
directory or description is describing a different generator, and says so in `generators` — where
the full shape is required anyway. The two mechanisms do not overlap; `templates` is applied last,
over the composed list, so a config that uses both gets the file's render.

**jiti became a direct dependency.** It was already in the tree under c12, and it is what loads a
template file, so a template in its own file is a typechecked TypeScript function exactly like one
written inline. ADR 0002's decision reaches further than it did — templates now live in files that
look like the files they emit, and are still not a template language.

**`defineTemplate` joins `defineConfig` on the public surface.** A file whose whole content is one
exported function has nowhere else to hang the type, and typed templates are the property ADR 0002
was defending.

**Config loading now reads a second thing off the disk.** It stays inside `loadConfig`, so
`resolveConfig` is still synchronous and `plan()` still sees an overridden generator as just a
generator.
