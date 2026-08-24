/**
 * What the target picker offers, and what it refuses to offer.
 *
 * `listTargets` takes the project's file list as an argument, so the whole
 * round-trip rule — the part that decides whether a pick would have worked —
 * is exercised without a filesystem. `listFiles` is the only part that touches
 * a disk, so it gets a real temporary tree.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRegistry, builtInGenerators } from './generators.ts'
import {
  createTargetSearch,
  listFiles,
  listTargets,
  noTargetsMessage,
} from './targets.ts'

import type { Generator } from './generators.ts'

// Both targeted generators live in presets, so the fixture registry turns them
// on rather than assuming a project would have.
const registry = createRegistry(builtInGenerators(['storybook', 'browser']))

/** The registry never returns undefined for an id it declares. */
function generator(id: string): Generator {
  const found = registry.find(id)
  if (!found) throw new Error(`no ${id} generator`)
  return found
}

const story = generator('story')
const hookTest = generator('hook-test')
const PROTECTED = ['src/components/ui']

function paths(files: Array<string>, id = 'story'): Array<string> {
  return listTargets(generator(id), files, registry, PROTECTED).map(
    (target) => target.path,
  )
}

describe('listTargets', () => {
  describe('the round trip', () => {
    it('offers a file whose name its target would have written', () => {
      expect(paths(['src/components/wibble.tsx'])).toEqual([
        'src/components/wibble.tsx',
      ])
    })

    it('offers a kebab-case name of several words', () => {
      expect(paths(['src/components/data-table.tsx'])).toEqual([
        'src/components/data-table.tsx',
      ])
    })

    it('refuses a name that does not survive the trip', () => {
      // `IconButton` derives `icon-button.tsx`, which is not this file, so the
      // run would refuse — offering it would be a trap.
      expect(paths(['src/components/IconButton.tsx'])).toEqual([])
    })

    it('refuses the output of the generator being run', () => {
      expect(paths(['src/components/wibble.stories.tsx'])).toEqual([])
    })

    it('refuses a file of the wrong extension', () => {
      expect(paths(['src/components/wibble.ts'])).toEqual([])
    })

    it('refuses a name with nothing to build a casing from', () => {
      expect(paths(['src/components/---.tsx'])).toEqual([])
    })
  })

  describe('for hook-test, whose target is always use-prefixed', () => {
    it('offers a hook', () => {
      expect(paths(['src/hooks/use-mouse.ts'], 'hook-test')).toEqual([
        'src/hooks/use-mouse.ts',
      ])
    })

    it('refuses a plain module, which would derive use-noop.ts', () => {
      expect(paths(['src/lib/noop.ts'], 'hook-test')).toEqual([])
    })

    it('refuses a hook test, which would derive the hook itself', () => {
      expect(
        paths(['src/hooks/use-mouse.browser.test.ts'], 'hook-test'),
      ).toEqual([])
    })
  })

  describe('files in a protected directory', () => {
    it('refuses a component under a protected directory', () => {
      // It round-trips perfectly; the story would be written beside it, and
      // that is refused even under --force.
      expect(paths([`${PROTECTED[0]}/button.tsx`])).toEqual([])
    })

    it('refuses one nested deeper inside it', () => {
      expect(paths([`${PROTECTED[0]}/menu/item.tsx`])).toEqual([])
    })

    it('offers a directory that merely starts with the same letters', () => {
      expect(paths(['src/components/uikit/button.tsx'])).toEqual([
        'src/components/uikit/button.tsx',
      ])
    })
  })

  describe('what a target carries', () => {
    it('reports the directory and the name a request derives from it', () => {
      const [target] = listTargets(
        story,
        ['src/components/wibble/wibble.tsx'],
        registry,
        PROTECTED,
      )

      expect(target).toMatchObject({
        directory: 'src/components/wibble',
        name: 'wibble',
        output: 'src/components/wibble/wibble.stories.tsx',
      })
    })

    it('flags a target whose output is already beside it', () => {
      const [target] = listTargets(
        story,
        ['src/components/wibble.tsx', 'src/components/wibble.stories.tsx'],
        registry,
        PROTECTED,
      )

      expect(target?.hasOutput).toBe(true)
    })

    it('leaves a target alone when only a namesake elsewhere has one', () => {
      const [target] = listTargets(
        story,
        ['src/components/wibble.tsx', 'src/widgets/wibble.stories.tsx'],
        registry,
        PROTECTED,
      )

      expect(target?.hasOutput).toBe(false)
    })
  })

  it('offers nothing for a generator that has no target', () => {
    expect(paths(['src/lib/noop.ts'], 'test')).toEqual([])
  })
})

describe('createTargetSearch', () => {
  const targets = listTargets(
    story,
    [
      'src/components/wibble.tsx',
      'src/components/wibble.stories.tsx',
      'src/components/data-table.tsx',
      'src/widgets/badge.tsx',
    ],
    registry,
    PROTECTED,
  )
  const search = () => createTargetSearch(targets, story)

  it('offers every target when nothing is typed', () => {
    expect(search()('').map((option) => option.value)).toEqual([
      'src/components/wibble.tsx',
      'src/components/data-table.tsx',
      'src/widgets/badge.tsx',
    ])
  })

  it('hints the targets that already have the output, and only those', () => {
    const hinted = search()('').filter((option) => option.hint)

    expect(hinted).toEqual([
      {
        value: 'src/components/wibble.tsx',
        label: 'src/components/wibble.tsx',
        hint: 'already has a story',
      },
    ])
  })

  it('ranks a fuzzy match above the rest', () => {
    expect(search()('dtab')[0]?.value).toBe('src/components/data-table.tsx')
  })

  it('drops anything the query does not match', () => {
    expect(search()('zzz')).toEqual([])
  })

  it('never invents a path, unlike the directory prompt', () => {
    expect(search()('brand-new')).toEqual([])
  })
})

describe('noTargetsMessage', () => {
  it('names the generator that would create one', () => {
    const message = noTargetsMessage(hookTest, registry)

    expect(message).toContain('no hooks to write a hook-test for')
    expect(message).toContain('scaffold hook <name> --with hook-test')
  })

  it('names the component generator for a story', () => {
    expect(noTargetsMessage(story, registry)).toContain(
      'no components to write a story for',
    )
  })
})

describe('listFiles', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'scaffold-targets-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function tree(directories: Array<string>, files: Array<string>): undefined {
    for (const path of directories)
      mkdirSync(join(root, path), { recursive: true })
    for (const path of files) writeFileSync(join(root, path), '')
  }

  it('lists files at the root and under it', () => {
    tree(['components'], ['env.ts', 'components/card.tsx'])

    expect(listFiles(root).sort()).toEqual(
      [join(root, 'env.ts'), join(root, 'components/card.tsx')].sort(),
    )
  })

  it('lists directories nowhere — only files can be a target', () => {
    tree(['components'], [])

    expect(listFiles(root)).toEqual([])
  })

  it('skips dotfiles, and anything inside a skipped directory', () => {
    tree(
      ['.storybook', 'node_modules'],
      ['.eslintrc', '.storybook/main.ts', 'node_modules/index.js'],
    )

    expect(listFiles(root)).toEqual([])
  })

  it('returns nothing when the root cannot be read', () => {
    expect(listFiles(join(root, 'does-not-exist'))).toEqual([])
  })
})
