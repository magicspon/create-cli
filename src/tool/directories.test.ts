/**
 * The wizard's directory suggestions.
 *
 * `listDirectories` is the only part that touches a disk, so it gets a real
 * temporary tree. Ranking and the new-directory suggestion are exercised
 * through `createDirectorySearch`, which takes its candidate list as an
 * argument and so needs no filesystem at all.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDirectorySearch, listDirectories } from './directories.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-directories-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function tree(...paths: Array<string>): undefined {
  for (const path of paths) mkdirSync(join(root, path), { recursive: true })
}

describe('listDirectories', () => {
  it('lists the root itself along with every directory under it', () => {
    tree('components', 'components/ui', 'hooks')

    expect(listDirectories(root).sort()).toEqual(
      [
        root,
        join(root, 'components'),
        join(root, 'components/ui'),
        join(root, 'hooks'),
      ].sort(),
    )
  })

  it('leads with the root, so the caller can rely on the first entry', () => {
    tree('components')
    expect(listDirectories(root)[0]).toBe(root)
  })

  it('skips dotfiles and node_modules, which are never a target', () => {
    tree('.storybook', 'node_modules/react', 'components')

    expect(listDirectories(root)).toEqual([root, join(root, 'components')])
  })

  it('lists files nowhere — only directories are a place to write to', () => {
    tree('components')
    writeFileSync(join(root, 'components/card.tsx'), '')

    expect(listDirectories(root)).toEqual([root, join(root, 'components')])
  })

  it('stops at four levels down, so a deep tree cannot run away', () => {
    tree('a/b/c/d/e')

    const found = listDirectories(root)

    expect(found).toContain(join(root, 'a/b/c/d'))
    expect(found).not.toContain(join(root, 'a/b/c/d/e'))
  })

  it('returns just the root when the root cannot be read', () => {
    const missing = join(root, 'does-not-exist')
    expect(listDirectories(missing)).toEqual([missing])
  })
})

describe('createDirectorySearch', () => {
  const fallback = 'src/components'
  const directories = [
    'src',
    'src/components',
    'src/hooks',
    'src/lib',
    'src/lib/gen',
  ]
  const search = () => createDirectorySearch(fallback, directories)

  describe('with no input', () => {
    it('offers every directory, with the fallback leading', () => {
      const options = search()('', undefined)

      expect(options.map((option) => option.value)).toEqual([
        'src/components',
        'src',
        'src/hooks',
        'src/lib',
        'src/lib/gen',
      ])
    })

    it('marks the fallback as the default, and nothing else', () => {
      const hinted = search()('', undefined).filter((option) => option.hint)

      expect(hinted).toEqual([
        { value: fallback, label: fallback, hint: 'default' },
      ])
    })

    it('offers a fallback that is not on disk, so Enter always works', () => {
      const options = createDirectorySearch('src/fixtures', ['src'])('', 'src')

      expect(options[0]?.value).toBe('src/fixtures')
    })
  })

  // How a match is *scored* is `fuzzy.test.ts`; what this prompt does with the
  // ranking is here.
  describe('filtering', () => {
    function ranked(query: string): Array<string> {
      return search()(query, undefined)
        .filter((option) => !option.hint?.startsWith('new'))
        .map((option) => option.value)
    }

    it('offers only what the query matches, best first', () => {
      expect(ranked('slgen')).toEqual(['src/lib/gen'])
    })

    it('drops anything the query does not match at all', () => {
      expect(ranked('zzz')).toEqual([])
    })

    it('ignores a trailing slash, which is how people type paths', () => {
      expect(ranked('src/lib/')).toEqual(ranked('src/lib'))
    })
  })

  describe('the new-directory suggestion', () => {
    it('creates a bare name inside the fallback before anything is focused', () => {
      const options = search()('widgets', undefined)

      expect(options.at(-1)).toEqual({
        value: 'src/components/widgets',
        label: 'src/components/widgets',
        hint: 'new — inside src/components',
      })
    })

    it('takes anything containing a slash literally', () => {
      const options = search()('src/fixtures/deep', undefined)

      expect(options.at(-1)).toEqual({
        value: 'src/fixtures/deep',
        label: 'src/fixtures/deep',
        hint: 'new directory',
      })
    })

    it('suggests nothing new when the path already exists', () => {
      const options = search()('src/lib/gen', undefined)

      expect(options.map((option) => option.value)).toEqual(['src/lib/gen'])
    })

    it('keeps the fuzzy match in the top slot', () => {
      const options = search()('slgen', undefined)

      expect(options[0]?.value).toBe('src/lib/gen')
      expect(options).toHaveLength(2)
    })
  })

  describe('anchoring', () => {
    it('creates a bare name inside the row the cursor was on', () => {
      const next = search()
      next('hooks', undefined) // land on src/hooks
      const options = next('widgets', 'src/hooks')

      expect(options.at(-1)?.value).toBe('src/hooks/widgets')
    })

    it('re-anchors only on a keystroke, not on a mid-render focus report', () => {
      const next = search()
      next('widgets', 'src/hooks')
      // Same input, different focus: the prompt is reporting the row it is
      // about to draw, which must not rewrite the suggestion under the cursor.
      const options = next('widgets', 'src/lib')

      expect(options.at(-1)?.value).toBe('src/hooks/widgets')
    })

    it('never anchors on a suggestion, only on a directory that exists', () => {
      const next = search()
      next('widgets', 'src/hooks')
      // `src/hooks/widgets` is the suggestion itself — anchoring on it would
      // nest every further keystroke one level deeper.
      const options = next('inner', 'src/hooks/widgets')

      expect(options.at(-1)?.value).toBe('src/hooks/inner')
    })
  })
})
