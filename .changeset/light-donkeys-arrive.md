---
'@magicspon/create-cli': minor
---

Lower the supported Node floor to 24.20.0. `engines.node` was `>=26.0.0`, which excluded the
current LTS line for no reason the code required — nothing in the package uses an API newer than
Node 24, and the build now targets that floor. The test suite runs on both ends of the range in CI.
