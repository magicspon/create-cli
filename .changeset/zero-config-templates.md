---
'@magicspon/scaffold': minor
---

Template files declare their own generator, so adding one needs no config file.

- `scaffold/templates` is discovered without setting `templates`. A directory you do name still
  refuses the run when it is missing.
- `defineTemplate(config, render)` declares a generator's `description`, `directory`, `fileName`
  and `target` in the template file itself. Over an existing generator every field is optional and
  the rest is inherited; for a new id, `fileName` is required. There is no `id` — the filename is
  the id.
- `defineTemplate(render)` is unchanged: it replaces that generator's render and nothing else.
- A `directory` key nothing configures now resolves to `src/<key>` rather than the project root,
  which is the rule the built-in defaults already followed. A `directory` containing a `/` is read
  as a path.
- A template naming a `target` that is not a generator now refuses the run instead of silently
  having no target.

`generators` in `scaffold.config.ts` is unchanged and still the right home for a generator built
programmatically or shared from a package.
