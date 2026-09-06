[![CI](https://github.com/magicspon/create-cli/actions/workflows/ci.yaml/badge.svg)](https://github.com/magicspon/create-cli/actions/workflows/ci.yaml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/magicspon/create-cli/actions/workflows/ci.yaml)
[![Fallow](https://github.com/magicspon/create-cli/actions/workflows/fallow.yml/badge.svg)](https://github.com/magicspon/create-cli/actions/workflows/fallow.yml) [![Release](https://github.com/magicspon/create-cli/actions/workflows/release.yaml/badge.svg)](https://github.com/magicspon/create-cli/actions/workflows/release.yaml) [![Renovate](https://github.com/magicspon/create-cli/actions/workflows/renovate.yaml/badge.svg)](https://github.com/magicspon/create-cli/actions/workflows/renovate.yaml)

# @magicspon/create-cli

A file scaffolder you configure in TypeScript. It ships a small set of generators, and your project
adds its own — templates are typechecked functions in your repo, not strings in a template language.

```ts
render: ({ pascalNam }) => `...`
//         ~~~~~~~~~~ Property 'pascalNam' does not exist on type 'TemplateContext'.
```

## Install

```bash
pnpm add -D @magicspon/create-cli
```

Then add a script, so the command is short for everyone on the project:

```json
{
  "scripts": {
    "scaffold": "scaffold"
  }
}
```

## Use it

There is no config file to write and no init step — it works immediately:

```bash
pnpm scaffold component DataTable
# + src/components/data-table.tsx

pnpm scaffold component DataTable --with story  # and its story beside it
pnpm scaffold hook mouse                        # + src/hooks/use-mouse.ts
pnpm scaffold component Card --dir src/features/cart
pnpm scaffold component Card --dry-run          # print it, write nothing
pnpm scaffold                                   # no name? it asks
```

Names are accepted in any casing: `DataTable`, `data table` and `data_table` all give you
`data-table.tsx`.

Out of the box you get `component`, `hook` and `test` — they assume nothing beyond React and Vitest.
Presets add `story`, `hook-test` and `msw-test` when your project has the runners for them.

## Add your own generator

Drop a file in `scaffold/templates`. The filename is the generator's name, and there is nothing to
register:

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

```bash
pnpm scaffold route checkout
# + src/routes/checkout.route.ts
```

`route` now appears in `--help`, in the wizard, and in every other generator's `--with`. Name a file
after a built-in instead — `component.ts` — and you replace that generator's output while keeping
its place, its directory and its filename.

## Everything else

Read the [usage guide](docs/USAGE.md) for presets, kits, targets, the full generator API and the
configuration reference, and [`docs/adr/`](docs/adr) for the decisions behind them.

## Requirements

Node 24.20.0+.

## License

MIT
