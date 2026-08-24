/**
 * A hook stub, `use`-prefixed and ready to be filled in.
 *
 * The state pair is a placeholder rather than a suggestion — it exists so the
 * file typechecks and runs the moment it is written, which is the rule every
 * template here follows.
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a hook stub whose name is already correct in every casing. */
export function renderHook({ hookName }: TemplateContext): string {
  return `import { useState } from 'react'

/** TODO: describe what \`${hookName}\` does. */
export function ${hookName}() {
  const [ready, setReady] = useState(false)

  return [ready, setReady] as const
}
`
}
