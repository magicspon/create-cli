/**
 * The write layer, against a real temporary directory.
 *
 * Only the cases that exist *because* there is real I/O: directories created on
 * demand, and nothing on disk when the plan was rejected. Everything about
 * which paths a request resolves to belongs in `plan.test.ts`, where it costs
 * no filesystem.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commit } from './commit.ts'

import type { Plan } from './plan.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const accepted: Plan = {
  ok: true,
  files: [
    {
      generator: 'component',
      path: 'src/components/card.tsx',
      contents: 'export function Card() {}\n',
    },
    {
      generator: 'story',
      path: 'src/components/card.stories.tsx',
      contents: 'export default {}\n',
    },
  ],
}

const rejected: Plan = {
  ok: false,
  kind: 'conflict',
  reason: 'src/components/card.tsx already exists.',
  path: 'src/components/card.tsx',
}

describe('commit', () => {
  it('writes every file in the plan, creating directories on demand', () => {
    commit(accepted, root)

    expect(readFileSync(join(root, 'src/components/card.tsx'), 'utf8')).toBe(
      'export function Card() {}\n',
    )
    expect(
      readFileSync(join(root, 'src/components/card.stories.tsx'), 'utf8'),
    ).toBe('export default {}\n')
  })

  it('returns the absolute path of everything it wrote', () => {
    expect(commit(accepted, root)).toEqual([
      join(root, 'src/components/card.tsx'),
      join(root, 'src/components/card.stories.tsx'),
    ])
  })

  it('writes nothing at all when the plan was rejected', () => {
    expect(() => commit(rejected, root)).toThrow(/rejected/i)
    expect(readdirSync(root)).toEqual([])
  })

  it('overwrites an existing file, because plan() already permitted it', () => {
    commit(accepted, root)
    commit(
      {
        ok: true,
        files: [
          {
            generator: 'component',
            path: 'src/components/card.tsx',
            contents: 'export function Card2() {}\n',
          },
        ],
      },
      root,
    )

    expect(readFileSync(join(root, 'src/components/card.tsx'), 'utf8')).toBe(
      'export function Card2() {}\n',
    )
  })
})
