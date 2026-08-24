/**
 * A hook test that runs in a real browser, not in a DOM shim.
 *
 * The hook is imported by co-location — same name, same directory — exactly as
 * `story` finds its component. The file lands in the `dom` Vitest project by
 * its `.browser.test.ts` suffix, which is what keeps it out of the `unit`
 * project, where there is no DOM to render into.
 *
 * `renderHook` returns a promise and carries `act` on its result, so both are
 * awaited here. The second case is `it.skip`: a typechecked worked example of
 * driving an update, which a generator cannot fill in because it does not know
 * the hook's API.
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a browser-mode test for the hook beside it. */
export function renderHookTest({
  hookName,
  targetImport,
}: TemplateContext): string {
  return `import { renderHook } from 'vitest-browser-react'
import { describe, expect, it } from 'vitest'
import { ${hookName} } from '${targetImport}'

describe('${hookName}', () => {
  // TODO: assert what \`${hookName}\` actually returns. This placeholder only
  // proves the hook mounts without throwing.
  it('returns a value on first render', async () => {
    const { result } = await renderHook(() => ${hookName}())

    expect(result.current).toBeDefined()
  })

  // Unskip once there is something to drive. \`act\` flushes the updates a real
  // interaction would queue — without it the assertion runs against the render
  // before the change.
  it.skip('updates when its state changes', async () => {
    const { result, act } = await renderHook(() => ${hookName}())

    await act(() => {
      // TODO: call whatever \`${hookName}\` returns to change its state.
    })

    expect(result.current).toBeDefined()
  })
})
`
}
