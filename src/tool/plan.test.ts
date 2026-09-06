/**
 * `plan()` is the whole scaffolder minus the two lines that touch the disk.
 *
 * Assertions here are on *which paths a request resolves to* and *whether it is
 * permitted* — the things a user depends on. Generated contents are asserted
 * only as properties (does the story's import point at its component?), never
 * as snapshots, because a snapshot of a template breaks on a whitespace tweak
 * without anything having regressed.
 */

import { describe, expect, it } from 'vitest'
import { resolveConfig } from './config.ts'
import { plan } from './plan.ts'

import type { Plan, PlanIO, ScaffoldRequest } from './plan.ts'

// Every preset on, so the composition and target cases below have `story` and
// `hook-test` to reach for. `protect` stands in for a directory another tool
// owns — shadcn's `ui` here, but the rule knows nothing about shadcn.
const config = resolveConfig(
  {
    presets: ['storybook', 'browser', 'msw'],
    protect: ['src/components/ui'],
  },
  '/repo',
)

/** A `PlanIO` whose disk contains exactly `existing`. */
function io(existing: Array<string> = []): PlanIO {
  const files = new Set(existing)
  return { config, exists: (path) => files.has(path) }
}

function run(request: ScaffoldRequest, existing: Array<string> = []): Plan {
  return plan(request, io(existing))
}

/** The plan's paths, or a readable failure if the run was rejected. */
function paths(result: Plan): Array<string> {
  if (!result.ok) throw new Error(`rejected: ${result.kind} — ${result.reason}`)
  return result.files.map((file) => file.path)
}

function contentsOf(result: Plan, path: string): string {
  if (!result.ok) throw new Error(`rejected: ${result.kind} — ${result.reason}`)
  const file = result.files.find((candidate) => candidate.path === path)
  if (!file) throw new Error(`no ${path} in plan: ${paths(result).join(', ')}`)
  return file.contents
}

describe('paths', () => {
  it('puts a component in the components directory, kebab-cased', () => {
    expect(paths(run({ generator: 'component', name: 'DataTable' }))).toEqual([
      'src/components/data-table.tsx',
    ])
  })

  it('derives the same path from any casing of the same name', () => {
    for (const name of [
      'DataTable',
      'data table',
      'data-table',
      'data_table',
    ]) {
      expect(paths(run({ generator: 'component', name }))).toEqual([
        'src/components/data-table.tsx',
      ])
    }
  })

  it('puts a hook in the hooks directory, use-prefixed', () => {
    expect(paths(run({ generator: 'hook', name: 'mouse' }))).toEqual([
      'src/hooks/use-mouse.ts',
    ])
  })

  it('keeps a hook called nothing but "use" from losing its name', () => {
    expect(paths(run({ generator: 'hook', name: 'use' }))).toEqual([
      'src/hooks/use-use.ts',
    ])
  })

  it('does not double the use prefix when the name already carries one', () => {
    expect(paths(run({ generator: 'hook', name: 'useMouse' }))).toEqual([
      'src/hooks/use-mouse.ts',
    ])
  })

  it('puts a story beside its component', () => {
    const result = run({ generator: 'story', name: 'Card' }, [
      'src/components/card.tsx',
    ])
    expect(paths(result)).toEqual(['src/components/card.stories.tsx'])
  })

  it('puts a unit test in the lib directory, beside plain modules', () => {
    expect(paths(run({ generator: 'test', name: 'formatMoney' }))).toEqual([
      'src/lib/format-money.test.ts',
    ])
  })

  it('names an msw test so it reads as one at a glance', () => {
    expect(paths(run({ generator: 'msw-test', name: 'payments' }))).toEqual([
      'src/lib/payments.msw.test.ts',
    ])
  })

  // The `.browser.` infix is load-bearing: it is the whole of how the `dom`
  // Vitest project claims this file and the `unit` project lets it go.
  it('puts a hook test beside its hook, marked for the browser project', () => {
    const result = run({ generator: 'hook-test', name: 'mouse' }, [
      'src/hooks/use-mouse.ts',
    ])
    expect(paths(result)).toEqual(['src/hooks/use-mouse.browser.test.ts'])
  })

  it('matches the hook file name from any casing of the same name', () => {
    for (const name of ['mouse', 'useMouse', 'use-mouse']) {
      const result = run({ generator: 'hook-test', name }, [
        'src/hooks/use-mouse.ts',
      ])
      expect(paths(result)).toEqual(['src/hooks/use-mouse.browser.test.ts'])
    }
  })

  it('honours an explicit directory', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/features/cart',
    })
    expect(paths(result)).toEqual(['src/features/cart/card.tsx'])
  })
})

describe('composition', () => {
  it('produces the union of the constituent generators paths', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['story'],
    })
    expect(paths(result)).toEqual([
      'src/components/card.tsx',
      'src/components/card.stories.tsx',
    ])
  })

  it('composes into an explicit directory as one group', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/features/cart',
      with: ['story'],
    })
    expect(paths(result)).toEqual([
      'src/features/cart/card.tsx',
      'src/features/cart/card.stories.tsx',
    ])
  })

  it('rejects a run whose generators collide with each other', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['component'],
    })
    expect(result).toMatchObject({
      ok: false,
      kind: 'conflict',
      path: 'src/components/card.tsx',
    })
  })
})

describe('conflicts', () => {
  it('rejects when a planned file already exists, naming the path', () => {
    const result = run({ generator: 'component', name: 'Card' }, [
      'src/components/card.tsx',
    ])
    expect(result).toMatchObject({
      ok: false,
      kind: 'conflict',
      path: 'src/components/card.tsx',
    })
  })

  it('rejects the whole run when only one file of several conflicts', () => {
    const result = run(
      { generator: 'component', name: 'Card', with: ['story'] },
      ['src/components/card.stories.tsx'],
    )
    expect(result).toMatchObject({
      ok: false,
      path: 'src/components/card.stories.tsx',
    })
  })

  it('permits an overwrite under force', () => {
    const result = run({ generator: 'component', name: 'Card', force: true }, [
      'src/components/card.tsx',
    ])
    expect(paths(result)).toEqual(['src/components/card.tsx'])
  })

  it('still rejects an in-plan collision under force', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['component'],
      force: true,
    })
    expect(result).toMatchObject({ ok: false, kind: 'conflict' })
  })
})

describe('targets', () => {
  it('permits a story whose component exists only in the same plan', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['story'],
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a story whose component exists nowhere, naming the component', () => {
    const result = run({ generator: 'story', name: 'Card' })
    expect(result).toMatchObject({
      ok: false,
      kind: 'missing-target',
      path: 'src/components/card.tsx',
    })
  })

  it('resolves the story import specifier to its component', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['story'],
    })
    const story = contentsOf(result, 'src/components/card.stories.tsx')
    // Extensionless: `./card.tsx` is a type error in any project that has not
    // switched on `allowImportingTsExtensions`, which is most of them.
    expect(story).toContain("from './card'")
    expect(story).not.toContain('card.tsx')
    expect(story).toContain('Card')
  })

  it('permits a hook test whose hook exists only in the same plan', () => {
    const result = run({
      generator: 'hook',
      name: 'mouse',
      with: ['hook-test'],
    })
    expect(paths(result)).toEqual([
      'src/hooks/use-mouse.ts',
      'src/hooks/use-mouse.browser.test.ts',
    ])
  })

  it('rejects a hook test whose hook exists nowhere, naming the hook', () => {
    expect(run({ generator: 'hook-test', name: 'mouse' })).toMatchObject({
      ok: false,
      kind: 'missing-target',
      path: 'src/hooks/use-mouse.ts',
    })
  })

  it('resolves the hook test import specifier to its hook', () => {
    const result = run({
      generator: 'hook',
      name: 'mouse',
      with: ['hook-test'],
    })
    const test = contentsOf(result, 'src/hooks/use-mouse.browser.test.ts')
    expect(test).toContain("from './use-mouse'")
    expect(test).toContain('useMouse()')
  })

  // The other two test generators write against whatever module the author
  // points them at, which no generator owns — so requiring a target would
  // refuse every honest use of them.
  it('needs nothing on disk for a unit test or an msw test', () => {
    for (const generator of ['test', 'msw-test'] as const) {
      expect(run({ generator, name: 'anything' }).ok).toBe(true)
    }
  })

  // A story without a `play` is invisible to the `storybook` Vitest project's
  // assertions, so the interaction test is part of the contract, not decoration.
  it('gives the story an interaction test', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      with: ['story'],
    })
    const story = contentsOf(result, 'src/components/card.stories.tsx')
    expect(story).toContain("from 'storybook/test'")
    expect(story).toContain('play: async ({ canvas })')
  })
})

// CONTEXT.md: a generator never writes a file the repo cannot execute. For the
// test generators that is the whole point — a scaffolded test that fails on
// arrival trains people to ignore a red run.
describe('test templates', () => {
  it('leaves the unit test importing no subject that may not exist', () => {
    const contents = contentsOf(
      run({ generator: 'test', name: 'formatMoney' }),
      'src/lib/format-money.test.ts',
    )
    expect(contents).toContain('it.todo(')
    // The only import is Vitest's own. Anything else would be a guess at a
    // module the author has not written yet.
    expect(contents.match(/^import .*/gm)).toEqual([
      "import { describe, it } from 'vitest'",
    ])
  })

  it('gives the msw test a server it can actually run', () => {
    const contents = contentsOf(
      run({ generator: 'msw-test', name: 'payments' }),
      'src/lib/payments.msw.test.ts',
    )
    expect(contents).toContain("from 'msw/node'")
    expect(contents).toContain('setupServer(')
    // Without this, an unhandled request silently hits the real network.
    expect(contents).toContain("onUnhandledRequest: 'error'")
  })
})

describe('protected directories', () => {
  it('rejects a request aimed straight at a protected directory', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/components/ui',
    })
    expect(result).toMatchObject({ ok: false, kind: 'protected' })
  })

  it('rejects a request aimed below a protected directory', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/components/ui/nested',
    })
    expect(result).toMatchObject({ ok: false, kind: 'protected' })
  })

  it('rejects even under force', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/components/ui',
      force: true,
    })
    expect(result).toMatchObject({ ok: false, kind: 'protected' })
  })

  // The guard exists to survive a typo, and a typo is exactly what these look
  // like. `commit()` joins the directory onto the package root, so every one of
  // these lands in the registry directory unless the path is normalised first.
  it('rejects a dressed-up path that still resolves into a protected directory', () => {
    for (const directory of [
      './src/components/ui',
      'src/components/ui/',
      'src/components/../components/ui',
      'src//components//ui',
    ]) {
      expect(
        run({ generator: 'component', name: 'Card', directory }),
      ).toMatchObject({ ok: false, kind: 'protected' })
    }
  })

  it('does not reject a sibling whose name merely starts the same', () => {
    const result = run({
      generator: 'component',
      name: 'Card',
      directory: 'src/components/uikit',
    })
    expect(paths(result)).toEqual(['src/components/uikit/card.tsx'])
  })
})

describe('directories', () => {
  it('normalises a directory before planning against it', () => {
    for (const directory of [
      './src/features/',
      'src//features',
      'src/x/../features',
    ]) {
      expect(
        paths(run({ generator: 'component', name: 'Card', directory })),
      ).toEqual(['src/features/card.tsx'])
    }
  })

  it('refuses a directory that escapes the package root', () => {
    for (const directory of ['../elsewhere', 'src/../../elsewhere', '..']) {
      expect(
        run({ generator: 'component', name: 'Card', directory }),
      ).toMatchObject({ ok: false, kind: 'invalid-directory' })
    }
  })

  it('refuses an absolute directory', () => {
    expect(
      run({ generator: 'component', name: 'Card', directory: '/etc' }),
    ).toMatchObject({ ok: false, kind: 'invalid-directory' })
  })
})

describe('names', () => {
  it('rejects a name that carries no usable characters', () => {
    for (const name of ['', '   ', '---', '///']) {
      expect(run({ generator: 'component', name })).toMatchObject({
        ok: false,
        kind: 'invalid-name',
      })
    }
  })
})
