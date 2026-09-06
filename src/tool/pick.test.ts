/**
 * The target prompt.
 *
 * `@clack/prompts` is mocked and answers with whatever the test queued, so each
 * case is one path through the picker: nothing to offer, a plain pick, a pick
 * over an output that already exists, and the two ways a run ends without
 * writing. The file tree is real, because which files are offerable is decided
 * by reading the project.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { autocomplete, cancel, confirm } from '@clack/prompts'
import { resolveConfig } from './config.ts'
import { pickTarget } from './pick.ts'

import type { Generator } from './generators.ts'
import type { ScaffoldConfig } from './config.ts'

vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  isCancel: () => false,
}))

let root: string
let config: ScaffoldConfig

/** Everything the picker said as it gave up. */
function cancelled(): string {
  return vi
    .mocked(cancel)
    .mock.calls.map(([message]) => message ?? '')
    .join(' ')
}

/**
 * Call a clack prompt's option getter the way clack calls it: as a method on
 * the live prompt, so `this.userInput` is whatever has been typed so far.
 */
function optionsOf<State>(
  prompt: { options: unknown },
  state: State,
): Array<{ value: unknown; label: string; hint?: string }> {
  const get = prompt.options as (
    this: State,
  ) => Array<{ value: unknown; label: string; hint?: string }>
  return get.call(state)
}

/** A project containing exactly these files, relative to its root. */
function project(files: Array<string>, user = {}): ScaffoldConfig {
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true })
    writeFileSync(join(root, file), '')
  }

  return resolveConfig({ presets: ['storybook'], ...user }, root)
}

/** The generator being pointed at something — `story`, whose target is a component. */
function story(scaffold: ScaffoldConfig): Generator {
  const generator = scaffold.registry.find('story')
  if (!generator) throw new Error('the storybook preset is not registered')
  return generator
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-pick-'))
  vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  vi.spyOn(process.stdin, 'unref').mockReturnValue(process.stdin)
  process.exitCode = undefined
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.mocked(autocomplete).mockReset()
  vi.mocked(confirm).mockReset()
  vi.mocked(cancel).mockReset()
  process.exitCode = undefined
})

describe('pickTarget', () => {
  it('gives up when there is nothing the generator can be written for', async () => {
    config = project(['src/hooks/use-mouse.ts'])

    expect(await pickTarget(story(config), config)).toBeNull()
    expect(cancelled()).toContain('scaffold component')
    expect(process.exitCode).toBe(1)
  })

  it('names the scope when it is the scope that emptied the list', async () => {
    config = project(['src/components/card.tsx'])

    expect(await pickTarget(story(config), config, 'src/widgets')).toBeNull()
    expect(cancelled()).toContain('Nothing under src/widgets')
    expect(process.exitCode).toBe(1)
  })

  it('answers the name and the directory at once, from the file picked', async () => {
    config = project(['src/components/card.tsx'])
    vi.mocked(autocomplete).mockResolvedValue('src/components/card.tsx')

    expect(await pickTarget(story(config), config)).toEqual({
      name: 'card',
      directory: 'src/components',
      force: false,
    })
  })

  it('offers only what the scope contains', async () => {
    config = project(['src/components/card.tsx', 'src/widgets/table.tsx'])
    vi.mocked(autocomplete).mockResolvedValue('src/widgets/table.tsx')

    await pickTarget(story(config), config, 'src/widgets')

    const options = vi.mocked(autocomplete).mock.calls[0]?.[0]
    if (!options) throw new Error('the prompt was never drawn')
    // The getter has already matched and ranked, so clack's own filter is off.
    expect(options.filter?.('', '' as never)).toBe(true)
    expect(optionsOf(options, { userInput: '' })).toEqual([
      {
        value: 'src/widgets/table.tsx',
        label: 'src/widgets/table.tsx',
        hint: undefined,
      },
    ])
  })

  it('refuses a path that is not one of the files it offered', async () => {
    config = project(['src/components/card.tsx'])
    vi.mocked(autocomplete).mockResolvedValue(
      'src/components/typed-by-hand.tsx',
    )

    expect(await pickTarget(story(config), config)).toBeNull()
    expect(cancelled()).toContain('not a file this run can be written against')
    expect(process.exitCode).toBe(1)
  })

  it('asks before overwriting an output that is already there, and forces on yes', async () => {
    config = project([
      'src/components/card.tsx',
      'src/components/card.stories.tsx',
    ])
    vi.mocked(autocomplete).mockResolvedValue('src/components/card.tsx')
    vi.mocked(confirm).mockResolvedValue(true)

    expect(await pickTarget(story(config), config)).toEqual({
      name: 'card',
      directory: 'src/components',
      force: true,
    })
    expect(vi.mocked(confirm).mock.calls[0]?.[0]?.message).toContain(
      'src/components/card.stories.tsx already exists',
    )
  })

  it('writes nothing, and does not fail, when the overwrite is declined', async () => {
    config = project([
      'src/components/card.tsx',
      'src/components/card.stories.tsx',
    ])
    vi.mocked(autocomplete).mockResolvedValue('src/components/card.tsx')
    vi.mocked(confirm).mockResolvedValue(false)

    expect(await pickTarget(story(config), config)).toBeNull()
    expect(vi.mocked(cancel)).toHaveBeenCalledWith('Nothing written.')
    // Declining is an answer, not a failure.
    expect(process.exitCode).toBe(0)
  })
})
