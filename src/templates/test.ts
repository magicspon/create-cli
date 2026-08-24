/**
 * The `describe`/`it` frame for a plain node unit test, and nothing that
 * pretends to know what is under it.
 *
 * It imports no subject on purpose. CONTEXT.md leaves "a test's cases" to
 * whoever opens the file, and a scaffolded import of a module that may not
 * exist is a file the repo cannot execute — the one thing a generator here must
 * never write.
 *
 * The cases are `it.todo`, so an unfinished test reports as a todo in `pnpm
 * test` rather than as a green assertion that asserts nothing. A red run
 * therefore always means something real.
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a node unit test: nested `describe` groups, cases left as todos. */
export function renderTest({ pascalName, kebabName }: TemplateContext): string {
  return `import { describe, it } from 'vitest'

// TODO: import the subject — \`./${kebabName}.ts\` if it sits beside this file.

describe('${pascalName}', () => {
  describe('given a valid input', () => {
    it.todo('returns what the caller asked for')
  })

  // The group worth writing second: what the happy path quietly assumes.
  describe('given nothing usable', () => {
    it.todo('refuses rather than guessing')
  })
})
`
}
