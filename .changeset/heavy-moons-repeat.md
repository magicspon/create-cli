---
'@magicspon/create-cli': major
---

Raise the supported Node floor to 26. `engines.node` is now `>=26.0.0` and the build targets
`node26`, matching the `@types/node` the package typechecks against — types ahead of the floor let
the build accept APIs that are missing at run time.

Installing on Node 20, 22 or 24 will now fail the engines check.
