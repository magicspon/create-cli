/**
 * The write layer, against a real temporary directory.
 *
 * Only the cases that exist *because* there is real I/O: directories created on
 * demand, and nothing on disk when the plan was rejected. Everything about
 * which paths a request resolves to belongs in `plan.test.ts`, where it costs
 * no filesystem.
 */

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commit, format } from './commit.ts'

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

describe('format', () => {
  /** An executable in the project's `node_modules/.bin` that records its argv. */
  function installBin(name: string, body: string): string {
    const bin = join(root, 'node_modules/.bin')
    mkdirSync(bin, { recursive: true })
    const path = join(bin, name)
    writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
    return path
  }

  it('runs nothing when there is nothing to run', () => {
    expect(format([], root, ['exit 1'])).toBeNull()
    expect(format(['a.ts'], root, [])).toBeNull()
  })

  it('reports the command it could not start', () => {
    expect(format(['a.ts'], root, ['definitely-not-a-binary --write'])).toBe(
      'could not run definitely-not-a-binary',
    )
  })

  it('reports a formatter that ran and refused', () => {
    installBin('grumpy', 'exit 3')

    expect(format(['a.ts'], root, ['grumpy --write'])).toBe('grumpy exited 3')
  })

  it('reports a formatter that was killed rather than exiting', () => {
    installBin('doomed', 'kill -TERM $$')

    expect(format(['a.ts'], root, ['doomed'])).toBe('doomed exited ?')
  })

  it('skips a command that is only whitespace', () => {
    expect(format(['a.ts'], root, ['   '])).toBeNull()
  })

  it('prefers the project’s own binary, and passes it the written paths', () => {
    const written = join(root, 'argv.txt')
    installBin('fmt', `printf '%s\\n' "$@" > "${written}"`)

    expect(format(['a.ts', 'b.ts'], root, ['fmt --write'])).toBeNull()
    expect(readFileSync(written, 'utf8')).toBe('--write\na.ts\nb.ts\n')
  })

  it('stops at the first command that fails, and runs every one that does not', () => {
    const first = join(root, 'first.txt')
    installBin('one', `printf 'ran' > "${first}"`)
    installBin('two', 'exit 2')

    expect(format(['a.ts'], root, ['one', 'two'])).toBe('two exited 2')
    expect(readFileSync(first, 'utf8')).toBe('ran')
  })
})
