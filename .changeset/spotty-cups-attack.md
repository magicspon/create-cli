---
'@magicspon/create-cli': patch
---

Update the development toolchain: pnpm 12, Vitest 5, and the oxc tools.

`@vitest/coverage-v8` was pinned to `4.1.11` while `vitest` moved to `^5.0.0`. Vitest 5 hands the
provider a coverage payload the v4 provider cannot read, so every `pnpm test:coverage` run died on
`Expected string coverage payload, received object` and reported 0%. The two now track the same
range, and coverage is back at 100%.

No change to the published package.
