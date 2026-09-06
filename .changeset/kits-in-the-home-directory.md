---
'@magicspon/create-cli': minor
---

Add **kits**: template directories in `~/.scaffold` rather than in a project, so one set of
generators can serve every repository on your machine.

```bash
npm install -g @magicspon/create-cli
scaffold kit new wibble
scaffold component Card --kit wibble
```

A kit is a template directory and nothing else — the same files and the same rules as
`scaffold/templates`, somewhere else. Name one with `--kit`, or with `kit` in
`scaffold.config.ts`; nothing under `~/.scaffold` applies unless it is named. A project's own
templates layer over a kit's field by field, so a repository can adopt a kit whole and override the
one generator that does not fit. `scaffold kit new` and `scaffold kit ls` manage them, and
`SCAFFOLD_HOME` overrides the location. (ADR 0007)

Two fixes that global installation needed:

- `scaffold` no longer requires a `package.json` above the working directory. It falls back to that
  directory, so it works outside a Node project.
- A `scaffold.config.ts` that imports `defineConfig` now loads under a global install. The tool
  resolves its own package from where the tool is installed rather than from the file being
  loaded, so a project no longer needs a local dependency for its config file to work.

`kit` is now a reserved generator id, since `scaffold kit` is a subcommand and subcommands are
generators. A generator of that id refuses the run and names the file.
