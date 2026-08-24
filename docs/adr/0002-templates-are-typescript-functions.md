# Templates are TypeScript functions, not a template language

> **Status:** accepted; the final consequence below is superseded by
> [ADR 0003](0003-generators-come-from-config.md). User-supplied templates are now supported, and
> they are still TypeScript functions — the decision here held, only the file they live in moved.

The plan started with Nunjucks. We use `(ctx: TemplateContext) => string` in a `.ts` file instead.

Generators do not inspect the files they generate against, so templating here is only ever
substituting one name in a few casings. `es-toolkit` is already a dependency and ships
`camelCase` / `kebabCase` / `pascalCase` / `snakeCase`, which is the main thing a template engine's
filters would have provided. What remained of Nunjucks was a language whose variables are not
typechecked — a misspelled `{{ componetName }}` renders empty and silently ships — interleaved with
JSX's own braces, with no editor support inside `.njk`.

As TypeScript functions, templates are typechecked against the context they receive, misspellings
are compile errors, and the editor treats them as code.

## Consequences

Template authors must escape backticks and `${` when generating code that itself uses template
literals. This is the real cost and it is accepted.

Templates do not need to manage their own indentation, because `oxfmt` runs over written files
afterwards.

Templates cannot be edited without recompiling, which rules out user-supplied templates. That is
fine while this is a project-local scaffolder; it is the thing to revisit if it is ever extracted
into a published package.

**Revisited in [ADR 0003](0003-generators-come-from-config.md).** It was extracted into a published
package, and this consequence no longer holds: a project supplies its own generators from
`scaffold.config.ts`, which c12 loads through jiti — so a user template is a typechecked
TypeScript function in their own project, and nothing here had to become stringly-typed.
