# The package ships compiled JavaScript

As project-local tooling this scaffolder had no build step, and that was a genuine feature: Node 24
strips the types, so the source ran directly and the thing you edited was the thing that executed.
Publishing ends it.

Node refuses to strip types inside `node_modules`:

```
ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
```

This is a deliberate restriction, not a gap waiting on a flag — a dependency's `.ts` file is
unloadable however modern the consumer's runtime. So the build is not an optimisation or a
concession to older Node. It is what makes the package importable at all.

## What builds it

[tsdown](https://tsdown.dev) (rolldown), emitting ESM plus declarations for the two entry points:
the `scaffold` binary and the `defineConfig` a project imports to write its config. The four
runtime dependencies stay external and resolve from the consumer's `node_modules`, so an install
does not ship a second copy of each.

## Consequences

**Source keeps its `.ts` import specifiers.** `import { plan } from './plan.ts'` is what lets the
source still run directly on bare Node during development — `pnpm scaffold` does exactly that — and
the bundler rewrites the specifiers on the way out. Local development keeps the no-build-step
property the published artefact cannot have.

**`types` must be declared explicitly in `tsconfig.json`.** Node's ambient types were reaching the
program only transitively, through whichever config file happened to be included; a build that
excluded those files silently lost `process` and `console`. `"types": ["node"]` states the
dependency rather than inheriting it by accident.

**The build is a CI gate.** A package that ships compiled output can break at release time in a way
the test suite never sees, so every PR builds.
