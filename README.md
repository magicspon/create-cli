# @magicspon/scaffold

A file scaffolder you configure in TypeScript. It ships a small set of generators, and your project
adds its own — templates are typechecked functions in your repo, not strings in a template
language.

```ts
render: ({ pascalNam }) => `...`
//         ~~~~~~~~~~ Property 'pascalNam' does not exist on type 'TemplateContext'.
```

- [Getting started](#getting-started)
- [Everyday use](#everyday-use)
- [Using presets](#using-presets)
- [Adding custom templates](#adding-custom-templates)
- [Configuration reference](#configuration-reference)
- [How it works](#how-it-works)

---

## Getting started

### 1. Install

```bash
pnpm add -D @magicspon/scaffold
```

<details>
<summary>npm / yarn / bun</summary>

```bash
npm install -D @magicspon/scaffold
yarn add -D @magicspon/scaffold
bun add -d @magicspon/scaffold
```

</details>

### 2. Add a script

Optional, but it makes the command short and self-documenting for everyone on the project. In
`package.json`:

```json
{
  "scripts": {
    "scaffold": "scaffold"
  }
}
```

Without a script, use `pnpm exec scaffold` (or `npx scaffold`) wherever this README says
`pnpm scaffold`.

### 3. Run it

There is no config file yet and no init step — it works immediately:

```bash
pnpm scaffold component DataTable
```

```
+ src/components/data-table.tsx
```

```tsx
import type { ComponentProps } from 'react'

export interface DataTableProps extends ComponentProps<'div'> {}

/** TODO: describe what `DataTable` renders. */
export function DataTable({ children, ...props }: DataTableProps) {
  return (
    <div data-testid="DataTable" {...props}>
      {children}
    </div>
  )
}
```

Out of the box you get three generators. They assume no styling library, component registry or
story format — only the things a React project already has:

| Generator   | Writes                              | Default location  | Imports  |
| ----------- | ----------------------------------- | ----------------- | -------- |
| `component` | A typed React component             | `src/components/` | `react`  |
| `hook`      | A custom React hook, `use`-prefixed | `src/hooks/`      | `react`  |
| `test`      | A Vitest unit test                  | `src/lib/`        | `vitest` |

The unit test deliberately imports no subject and leaves its cases as `it.todo`, so it passes on
arrival rather than failing against a module that may not exist yet.

Names are accepted in any casing — `DataTable`, `data table`, `data_table` and `data-table` all
produce `data-table.tsx`.

### 4. Add a config file when you need one

You only need one to change directories, switch on a [preset](#using-presets), or add your own
[templates](#adding-custom-templates).

```ts
// scaffold.config.ts
import { defineConfig } from '@magicspon/scaffold'

export default defineConfig({
  directories: {
    components: 'app/ui',
  },
})
```

`directories` is merged over the defaults, so naming one key keeps the rest.

> `scaffold.config.ts`, `scaffold.config.js`, `.scaffoldrc` and a `scaffold` key in `package.json`
> all work. The file is found by walking up to the nearest package root, so the tool behaves the
> same run from `src/components` as from the repo root.

### 5. Try the wizard

Run it bare and it asks instead:

```bash
pnpm scaffold
```

Running it with a name is fully non-interactive, so an agent drives the same tool a person does.
Accepting the wizard's default directory means exactly what omitting `--dir` means, so the two
routes cannot diverge. In a pipe with no terminal it refuses rather than hanging on a prompt.

---

## Everyday use

Every generator takes the same four flags:

| Flag        | Effect                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| `--dir`     | Target directory. Omit it and the generator uses its configured default  |
| `--with`    | Extra generators in the same run — `--with story` or `--with hook,story` |
| `--dry-run` | Print every path and its contents; write nothing                         |
| `--force`   | Overwrite files that already exist                                       |

```bash
pnpm scaffold component DataTable                    # one file
pnpm scaffold component DataTable --with story       # and its story beside it
pnpm scaffold story DataTable                        # retrofit onto an existing component
pnpm scaffold hook mouse                             # src/hooks/use-mouse.ts
pnpm scaffold component Card --dir src/features/cart # somewhere else
pnpm scaffold component Card --dry-run               # show me first
```

Run `pnpm scaffold --help` for the generator list, and `pnpm scaffold <generator> --help` for its
flags. Both are generated from your config, so your own generators appear there too.

### Check before you write

`--dry-run` prints every path **and its full contents**, then writes nothing:

```bash
pnpm scaffold component Card --with story --dry-run
```

It is the same code path as a real run, stopped one stage early, so what you inspect and what a
real run commits cannot drift apart.

---

## Using presets

Presets are groups of built-in generators that stay **off** until you ask for them, because each
emits files that import a runner your project may not have. Switching one on when the runner is
missing would scaffold a file your project cannot execute.

| Preset      | Adds        | Writes                                   | Your project needs               |
| ----------- | ----------- | ---------------------------------------- | -------------------------------- |
| `storybook` | `story`     | A story with a `play` interaction test   | `@storybook/react`, `storybook`  |
| `browser`   | `hook-test` | A hook test that runs in a real browser  | `vitest`, `vitest-browser-react` |
| `msw`       | `msw-test`  | A test with msw intercepting the network | `vitest`, `msw`                  |

### Switching one on

```ts
// scaffold.config.ts
import { defineConfig } from '@magicspon/scaffold'

export default defineConfig({
  presets: ['storybook'],
})
```

`story` is now a generator like any other:

```bash
pnpm scaffold --help
# USAGE scaffold component|hook|test|story

pnpm scaffold component Card --with story
# + src/components/card.tsx
# + src/components/card.stories.tsx
```

Enable several at once:

```ts
export default defineConfig({
  presets: ['storybook', 'browser', 'msw'],
})
```

A preset name nothing registers is an error rather than a silent no-op, because a typo that quietly
produced fewer generators reads as the tool being broken:

```
✖ There is no "storybok" preset. Available: storybook, browser, msw.
```

### What each preset generates

<details>
<summary><code>storybook</code> → <code>card.stories.tsx</code></summary>

Imports `@storybook/react` and `storybook/test`. The `Default` story carries a `play` function, so
it is an interaction test from the first run rather than a render-only story.

</details>

<details>
<summary><code>browser</code> → <code>use-mouse.browser.test.ts</code></summary>

Imports `vitest-browser-react`. The `.browser.` infix is load-bearing — it is how a browser-mode
Vitest project claims the file and a node project lets it go. Written beside its hook.

</details>

<details>
<summary><code>msw</code> → <code>payments.msw.test.ts</code></summary>

Imports `msw` and `msw/node`. Unlike the other test templates this one is complete and passing from
the first run: it stands up a server, handles a route, and asserts on it, with
`onUnhandledRequest: 'error'` so a typo'd URL fails loudly instead of reaching the real network.

</details>

### Turning a built-in off

`disable` removes any generator by id, built-in or preset:

```ts
export default defineConfig({
  presets: ['storybook'],
  disable: ['test'],
})
```

---

## Adding custom templates

A generator is a name, a filename, and a function returning the file's contents. That function is
ordinary TypeScript in your repo — typechecked against the context it receives, with autocomplete,
go-to-definition and refactoring, because it is code rather than a string in a template language.

### A first generator

```ts
// scaffold.config.ts
import { defineConfig } from '@magicspon/scaffold'

export default defineConfig({
  directories: {
    routes: 'src/routes',
  },
  generators: [
    {
      id: 'route',
      description: 'A route module',
      directory: 'routes',
      fileName: ({ kebabName }) => `${kebabName}.route.ts`,
      render: ({ kebabName, pascalName }) =>
        `export const ${pascalName}Route = {\n` +
        `  path: '/${kebabName}',\n` +
        `}\n`,
    },
  ],
})
```

```bash
pnpm scaffold route checkout
# + src/routes/checkout.route.ts
```

`route` now appears in `--help`, in the wizard, and in every other generator's `--with`. There is
no second place to register it.

### The generator API

| Field         | Required | Meaning                                                                                                        |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `id`          | yes      | The subcommand name. Reuse a built-in id to [replace it](#replacing-a-built-in)                                |
| `description` | yes      | Shown in `--help` and in the wizard                                                                            |
| `directory`   | yes      | **A key into `directories`**, not a path. Unconfigured keys fall back to the project root                      |
| `fileName`    | yes      | `(casings) => string`, relative to the resolved directory                                                      |
| `render`      | yes      | `(context) => string`, the file's full contents                                                                |
| `target`      | no       | The id of a generator whose output this one writes _beside_ — see [targets](#writing-against-an-existing-file) |

`directory` being a key rather than a path is what lets one config move every generator's output at
once, and what makes `--dir` mean the same thing for your generators as for the built-in ones.

### The template context

`render` and `fileName` receive the name in every casing they might need, plus the resolved paths:

| Field           | Example for `scaffold route DataTable`                    |
| --------------- | --------------------------------------------------------- |
| `kebabName`     | `data-table`                                              |
| `pascalName`    | `DataTable`                                               |
| `hookName`      | `useDataTable` — never doubles an existing `use`          |
| `kebabHookName` | `use-data-table`                                          |
| `directory`     | `src/routes`                                              |
| `path`          | `src/routes/data-table.route.ts`                          |
| `targetImport`  | `./data-table`, empty unless the generator has a `target` |
| `imports`       | whatever you put in [`imports`](#imports)                 |

### Writing against an existing file

Set `target` to another generator's id and yours becomes a generator that writes _beside_ an
existing file rather than inventing a new one. Resolution is by co-location — same name, same
directory — and the target's contents are never read.

```ts
export default defineConfig({
  generators: [
    {
      id: 'doc',
      description: 'An MDX doc for a component beside it',
      directory: 'components',
      fileName: ({ kebabName }) => `${kebabName}.mdx`,
      target: 'component',
      render: ({ pascalName, targetImport }) =>
        `# ${pascalName}\n\nImported from \`${targetImport}\`.\n`,
    },
  ],
})
```

You get three things for free:

```bash
pnpm scaffold doc Card
# ✖ doc needs src/components/card.tsx, which does not exist.
#   Generate it in the same run with --with component.

pnpm scaffold component Card --with doc   # composes, in one run
# + src/components/card.tsx
# + src/components/card.mdx

pnpm scaffold doc                          # with no name, offers the real list
```

That last one is the payoff: a generator with a `target` gets a fuzzy-searchable picker of the files
it could be written against, and rows that already have the output are hinted and ask before
overwriting.

### Replacing a built-in

Reuse its id. The built-in is replaced **in place**, so `component` keeps its position in `--with`
and in the wizard while emitting your house style — rather than you having to disable one id and
introduce a second under a different name:

```ts
export default defineConfig({
  imports: { utils: '#/lib/utils' },
  generators: [
    {
      id: 'component',
      description: 'A component in our house style',
      directory: 'components',
      fileName: ({ kebabName }) => `${kebabName}.tsx`,
      render: ({
        pascalName,
        imports,
      }) => `import { cn } from '${imports.utils}'

import type { ComponentProps } from 'react'

export interface ${pascalName}Props extends ComponentProps<'div'> {}

export function ${pascalName}({ className, ...props }: ${pascalName}Props) {
  return <div className={cn('', className)} {...props} />
}
`,
    },
  ],
})
```

### `imports`

Rather than hard-coding your project's aliases into every template, declare them once:

```ts
export default defineConfig({
  imports: {
    utils: '#/lib/utils',
    api: '#/lib/api-client',
  },
})
```

They arrive as `context.imports`, so moving an alias is a one-line change instead of a sweep through
every template.

### Writing templates well

Four things worth knowing before you write a long one:

**Emit already-formatted output.** [`format`](#format) runs nothing by default, so what you write is
what lands on disk.

**Use extensionless relative imports.** `./card` rather than `./card.tsx` — the latter is a type
error in any project that has not switched on `allowImportingTsExtensions`, which is most of them.
`targetImport` is already extensionless.

**Escape backticks and `${`** when generating code that itself uses template literals. This is the
real cost of templates being TypeScript functions, and it is the one thing a template language would
have done better:

```ts
render: ({ pascalName }) => `const label = \`\${count} ${pascalName}s\`\n`
```

**Never read the target's contents.** Given the same name and directory a generator must produce the
same bytes. Deriving a symbol from the name by casing convention is occasionally wrong and always a
one-line fix; parsing the target is neither.

### Keeping templates in separate files

`render` is just a function, so a config that has outgrown one file can move them out:

```ts
// scaffold.config.ts
import { defineConfig } from '@magicspon/scaffold'
import { renderRoute } from './scaffold/route'

export default defineConfig({
  generators: [
    {
      id: 'route',
      description: 'A route module',
      directory: 'routes',
      fileName: ({ kebabName }) => `${kebabName}.route.ts`,
      render: renderRoute,
    },
  ],
})
```

```ts
// scaffold/route.ts
import type { TemplateContext } from '@magicspon/scaffold'

export function renderRoute({
  kebabName,
  pascalName,
}: TemplateContext): string {
  return `export const ${pascalName}Route = {\n  path: '/${kebabName}',\n}\n`
}
```

`Generator`, `TemplateContext`, `NameCasings` and `ScaffoldUserConfig` are all exported for this.

> The import above is extensionless, which is what typechecks under
> `moduleResolution: "bundler"` — the setting most React projects use. Under `node16`/`nodenext`,
> write `'./scaffold/route.js'` instead; the config is loaded by [jiti](https://github.com/unjs/jiti),
> which resolves either.

---

## Configuration reference

Every field is optional.

| Field         | Default                                  | Meaning                                               |
| ------------- | ---------------------------------------- | ----------------------------------------------------- |
| `directories` | `src/components`, `src/hooks`, `src/lib` | Where each generator writes, keyed by its `directory` |
| `presets`     | `[]`                                     | Built-in groups to switch on                          |
| `generators`  | `[]`                                     | Your own generators                                   |
| `disable`     | `[]`                                     | Generator ids to switch off                           |
| `imports`     | `{}`                                     | Import specifiers your templates reference            |
| `protect`     | `[]`                                     | Directories no generator may write into               |
| `format`      | `[]`                                     | Commands run over written files                       |

### `protect`

For directories another tool owns and overwrites. Under shadcn that is the registry directory,
which `shadcn add` rewrites:

```ts
export default defineConfig({ protect: ['src/components/ui'] })
```

```
$ pnpm scaffold component Button --dir src/components/ui --force
✖ src/components/ui is protected by scaffold.config.ts — another tool owns it
  and will overwrite it. Write to a directory this project owns instead.
```

A protected directory is refused **even under `--force`**, and dressed-up paths like
`src/components/../components/ui` are refused too. That refusal is the point: the hazard it guards
against is a typo, and a typo is exactly as likely on a forced run.

### `format`

Commands run over the files a run wrote, each receiving their paths as arguments, resolved from your
`node_modules/.bin` first:

```ts
export default defineConfig({ format: ['prettier --write'] })
```

```ts
export default defineConfig({ format: ['oxfmt', 'oxlint --fix'] })
```

Empty by default, which is why every built-in template emits already-formatted output. A formatter
failing never fails the run — the files landed, and reporting failure with files on disk is the one
outcome the all-or-nothing rule exists to prevent.

---

## How it works

### One generator, one file

Each generator emits exactly one file. Producing a component with a story is composition
(`--with story`), not a special mode, which is why retrofitting a story onto a component you wrote
weeks ago is the same code path as generating both at once rather than a second one. See
[ADR 0001](docs/adr/0001-generators-emit-one-file.md).

### Nothing is ever half-written

A run resolves to a **plan** — every path and its contents — which is validated in full before
anything is written. If any part of it is refused, the whole run is refused: nothing lands, the
offending path is named, and the exit code is non-zero.

```
$ pnpm scaffold story Card
✖ story needs src/components/card.tsx, which does not exist. Generate it in the same run with --with component.
```

Existence checks run against files on disk **union** files already in the plan. That one rule is why
`component Card --with story` succeeds while `story Card` alone against a missing component fails.

### Picking a target

Generators with a `target` write beside a file that already exists, so with no name they offer the
real list rather than asking you to remember it. Matching is fuzzy, on a subsequence rather than a
substring, so `dtab` finds `data-table.tsx`.

The wizard's directory prompt works the same way, with one addition: **a name that matches nothing is
created inside the row currently highlighted.**

```
◆  Directory
│  Search: compx
│  ● src/components/compx   (new — inside src/components)
└
```

Anything containing a `/` is taken literally instead, which is how you get out of the highlighted
location. The directory is created when the file is written, so abandoning the wizard at a later
prompt leaves nothing behind.

---

## Requirements

Node 20.19+. The package ships compiled JavaScript — Node refuses to strip types inside
`node_modules`, so a published `.ts` file would be unloadable at any version. See
[ADR 0004](docs/adr/0004-the-package-ships-compiled-javascript.md).

## License

MIT
