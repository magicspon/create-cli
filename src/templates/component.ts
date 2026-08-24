/**
 * A typed React component, and nothing that assumes a styling library.
 *
 * An earlier version imported a `cn` class-merger from the project's `utils`
 * alias, which quietly made the core generator require shadcn. It now emits
 * plain React; a project that wants its own house style overrides `component`
 * in `scaffold.config.ts`, where `imports` is there precisely so a replacement
 * can reach for `cn` again. (ADR 0003)
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a typed component with a props interface ready to be extended. */
export function renderComponent({ pascalName }: TemplateContext): string {
  // `ComponentProps` is imported by name rather than reached through a `React.`
  // namespace: `verbatimModuleSyntax` is common, and nothing imports that
  // namespace under it.
  return `import type { ComponentProps } from 'react'

export interface ${pascalName}Props extends ComponentProps<'div'> {}

/** TODO: describe what \`${pascalName}\` renders. */
export function ${pascalName}({ children, ...props }: ${pascalName}Props) {
  return (
    <div data-testid="${pascalName}" {...props}>
      {children}
    </div>
  )
}
`
}
