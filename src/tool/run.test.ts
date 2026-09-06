/**
 * Plan, report, write — the layer both front ends go through.
 *
 * Against a real temporary directory, because the only thing this file adds to
 * `plan()` is the I/O: what lands on disk, what is printed instead, and what
 * exit code a caller gets. Which paths a request resolves to belongs in
 * `plan.test.ts`, where it costs no filesystem.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveConfig } from './config.ts'
import { countFiles, execute, resolveRun } from './run.ts'

import type { MockInstance } from 'vitest'
import type { ScaffoldConfig } from './config.ts'

let root: string
let config: ScaffoldConfig
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-run-'))
  config = resolveConfig({}, root)
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** Everything the run printed to stdout, as one string. */
function printed(): string {
  return log.mock.calls.map((call) => call.join(' ')).join('\n')
}

describe('countFiles', () => {
  it('singularises one and pluralises the rest', () => {
    expect(countFiles(0)).toBe('0 files')
    expect(countFiles(1)).toBe('1 file')
    expect(countFiles(2)).toBe('2 files')
  })
})

describe('resolveRun', () => {
  it('answers "exists" from the real filesystem', () => {
    mkdirSync(join(root, 'src/components'), { recursive: true })
    writeFileSync(join(root, 'src/components/card.tsx'), '')

    const result = resolveRun({ generator: 'component', name: 'Card' }, config)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('conflict')
  })

  it('accepts the same request when nothing is there', () => {
    expect(
      resolveRun({ generator: 'component', name: 'Card' }, config).ok,
    ).toBe(true)
  })
})

describe('execute', () => {
  it('writes the plan and names every file it wrote', () => {
    expect(execute({ generator: 'component', name: 'Card' }, config)).toBe(0)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
    expect(printed()).toContain('+ src/components/card.tsx')
  })

  it('prints the plan and its contents without writing, on a dry run', () => {
    expect(
      execute({ generator: 'component', name: 'Card', dryRun: true }, config),
    ).toBe(0)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(false)
    expect(printed()).toContain('Would write 1 file:')
    expect(printed()).toContain('export function Card')
  })

  it('reports a refusal on stderr and exits non-zero', () => {
    expect(execute({ generator: 'nope', name: 'Card' }, config)).toBe(1)

    expect(error.mock.calls.join(' ')).toContain('no "nope" generator')
  })

  it('says which kit a run resolved with, and nothing when there is none', () => {
    execute({ generator: 'component', name: 'Card' }, config)
    expect(printed()).not.toContain('kit:')

    execute(
      { generator: 'component', name: 'Table' },
      resolveConfig({}, root, null, [], 'wibble'),
    )
    expect(printed()).toContain('· kit: wibble')
  })

  it('writes the files but warns when the formatter fails', () => {
    const formatted = resolveConfig({ format: ['node --not-a-flag'] }, root)

    expect(execute({ generator: 'component', name: 'Card' }, formatted)).toBe(0)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
    expect(error.mock.calls.join(' ')).toContain('format them by hand')
  })
})
