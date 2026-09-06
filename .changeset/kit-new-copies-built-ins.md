---
'@magicspon/create-cli': minor
---

`scaffold kit new` now seeds a kit with a copy of the built-in templates rather than one starter
stub. `scaffold kit new gary` writes `component.ts`, `hook.ts` and `test.ts` — the real sources,
comments and all, each carrying its generator's config in full so it declares that generator in a
project that never had it as readily as it overrides one that did.

Presets are copied only when named: `scaffold kit new gary --preset storybook --preset msw`. A kit
applies to every project that adopts it, so a `story.ts` nobody asked for would hand a project with
no Storybook a `story` generator.
