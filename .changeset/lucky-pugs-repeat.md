---
'@magicspon/scaffold': minor
---

Add `templates`, a directory of template files matched to generators by filename.

A file named after a generator — `templates/component.ts`, `templates/hook-test.ts` — replaces that
generator's render and nothing else, so a project emitting its own house style no longer has to
restate the generator's description, directory and `fileName` around the one function it wanted to
change. It works for a generator the project declared itself as readily as for a built-in.

A template exports its render function as the default export or as `render`, and a `_`-prefixed file
is a helper rather than a template. A file matching no generator refuses the run rather than quietly
scaffolding the built-in output. `defineTemplate` and the `Template` type are exported for typing a
template file.
