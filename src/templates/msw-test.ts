/**
 * A node test with msw intercepting the network.
 *
 * Unlike the other test templates this one is complete and passing from the
 * first run: it stands up a server, handles one route and asserts on it, so
 * `pnpm test` proves the interception works before anyone edits a line. The
 * URL is a placeholder; the wiring around it is not.
 *
 * The server is declared per file rather than shared from a central `handlers`
 * module. A handler list sitting beside the test it explains is the reason to
 * reach for msw at all — hoist it only once two files genuinely want the same
 * one.
 *
 * The lifecycle hooks take block bodies, not concise ones. `server.listen()`
 * returns void, and a lint rule of the `no-confusing-void-expression` family
 * rewrites a concise body into a block — so emitting the block directly is what
 * keeps the scaffold clean on arrival under a project's own `format` commands.
 */

import type { TemplateContext } from '../tool/generators.ts'

/** Render a self-contained msw test — server, handlers, and two cases. */
export function renderMswTest({
  pascalName,
  kebabName,
}: TemplateContext): string {
  return `import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const endpoint = 'https://api.example.com/${kebabName}'

const server = setupServer(
  http.get(endpoint, () => HttpResponse.json({ name: '${pascalName}' })),
)

// \`error\` fails the run on a request nothing handles, so a typo'd URL reads as
// a failing test instead of quietly reaching the real network.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
// Per-test overrides must not leak into the next test.
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

describe('${pascalName}', () => {
  // TODO: call the code that does the fetching, rather than fetching here.
  it('reads the intercepted response', async () => {
    const response = await fetch(endpoint)

    await expect(response.json()).resolves.toEqual({ name: '${pascalName}' })
  })

  // The case the happy path hides: \`server.use\` replaces a handler for this
  // test only, which is how a failure is tested without a second server.
  it('handles a failing response', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
    )

    const response = await fetch(endpoint)

    expect(response.status).toBe(500)
  })
})
`
}
