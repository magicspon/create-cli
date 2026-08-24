/**
 * The scorer, tested directly rather than through a prompt.
 *
 * These cases lived in `directories.test.ts` and were reached through
 * `createDirectorySearch`, which meant every one of them also depended on the
 * fallback rule and the new-directory suggestion. They are about matching, so
 * they belong beside the matcher — and there are two prompts using it now.
 */

import { describe, expect, it } from 'vitest'
import { fuzzyScore, normalise } from './fuzzy.ts'

describe('fuzzyScore', () => {
  it('matches a subsequence, not a substring', () => {
    // `slgen` is the abbreviation someone types for src/lib/gen.
    expect(fuzzyScore('slgen', 'src/lib/gen')).toBeGreaterThanOrEqual(0)
  })

  it('returns -1 for anything the query does not match', () => {
    expect(fuzzyScore('zzz', 'src/lib')).toBe(-1)
  })

  it('returns -1 when the characters match but the order does not', () => {
    expect(fuzzyScore('bil', 'src/lib')).toBe(-1)
  })

  it('prefers a match on a segment boundary over one mid-word', () => {
    expect(fuzzyScore('sl', 'src/lib')).toBeGreaterThan(
      fuzzyScore('sl', 'src/apples'),
    )
  })

  it('prefers adjacent characters over scattered ones', () => {
    expect(fuzzyScore('lib', 'src/lib')).toBeGreaterThan(
      fuzzyScore('lib', 'src/lazy/i/b'),
    )
  })

  it('breaks a tie towards the shorter path', () => {
    expect(fuzzyScore('src', 'src/lib')).toBeGreaterThan(
      fuzzyScore('src', 'src/lib/generators'),
    )
  })

  it('ignores case on both sides', () => {
    expect(fuzzyScore('LIB', 'src/lib')).toBe(fuzzyScore('lib', 'src/LIB'))
  })

  it('scores an empty query without matching anything', () => {
    expect(fuzzyScore('', 'src/lib')).toBeLessThan(0)
  })
})

describe('normalise', () => {
  it('drops a trailing slash, which is how people type paths', () => {
    expect(normalise('src/lib/')).toBe('src/lib')
  })

  it('drops a run of trailing slashes', () => {
    expect(normalise('src/lib///')).toBe('src/lib')
  })

  it('trims surrounding whitespace', () => {
    expect(normalise('  src/lib  ')).toBe('src/lib')
  })

  it('leaves an interior slash alone', () => {
    expect(normalise('src/lib/gen')).toBe('src/lib/gen')
  })
})
