---
'@magicspon/scaffold': minor
---

Extract the scaffolder into a publishable package.

- Generators now come from a `scaffold.config.ts` loaded with c12, so a project can add its own —
  still as typechecked TypeScript functions, not a template language. `defineConfig` is exported
  for that.
- Built-ins split into an always-on core (`component`, `hook`, `test`) that assumes nothing beyond
  React, and opt-in presets (`storybook`, `browser`, `msw`) that need a runner a project may not
  have.
- Dropped the hard dependency on shadcn's `components.json`. Directories are configured, the
  registry-owned directory became a general `protect` list, and the hard-coded `oxfmt` step became
  a configurable `format` list. All three default to something that works with no config at all.
- Templates emit extensionless relative imports, which is what typechecks in a project that has not
  enabled `allowImportingTsExtensions`.
- Ships compiled JavaScript, because Node refuses to strip types inside `node_modules`.
