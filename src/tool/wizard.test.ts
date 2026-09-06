/**
 * The argumentless path.
 *
 * Each case is one run of the wizard with its answers queued in advance, and
 * the assertion is on what reached the disk — the point of the wizard being
 * that it ends in the same `execute` as the flags, so answering four prompts
 * and typing four flags cannot diverge.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  autocomplete,
  cancel,
  confirm,
  intro,
  multiselect,
  note,
  select,
  text,
} from '@clack/prompts'
import { resolveConfig } from './config.ts'
import { runWizard } from './wizard.ts'

import type { MockInstance } from 'vitest'
import type { ScaffoldConfig } from './config.ts'

vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  intro: vi.fn(),
  multiselect: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  isCancel: () => false,
}))

let root: string
let error: MockInstance<typeof console.error>

/** Everything the wizard said as it gave up. */
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

/** A prompt's validator, which clack types as "a function or a schema". */
function validatorOf(prompt: {
  validate?: unknown
}): (value: string) => string | undefined {
  return prompt.validate as (value: string) => string | undefined
}

/** A project containing exactly these files, relative to its root. */
function project(files: Array<string> = [], user = {}): ScaffoldConfig {
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true })
    writeFileSync(join(root, file), '')
  }

  return resolveConfig({ presets: ['storybook'], ...user }, root)
}

function setTTY(value: boolean): void {
  for (const stream of [process.stdin, process.stdout]) {
    Object.defineProperty(stream, 'isTTY', { value, configurable: true })
  }
}

const originalTTY = {
  stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
  stdout: Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'),
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-wizard-'))
  vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  vi.spyOn(process.stdin, 'unref').mockReturnValue(process.stdin)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
  setTTY(true)
  process.exitCode = undefined
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  for (const mock of [
    autocomplete,
    cancel,
    confirm,
    intro,
    multiselect,
    note,
    select,
    text,
  ]) {
    vi.mocked(mock).mockReset()
  }
  if (originalTTY.stdin) {
    Object.defineProperty(process.stdin, 'isTTY', originalTTY.stdin)
  }
  if (originalTTY.stdout) {
    Object.defineProperty(process.stdout, 'isTTY', originalTTY.stdout)
  }
  process.exitCode = undefined
})

describe('runWizard', () => {
  it('refuses without a terminal rather than answering itself', async () => {
    setTTY(false)

    await runWizard(project())

    expect(error.mock.calls.join(' ')).toContain('needs a terminal')
    expect(process.exitCode).toBe(1)
    expect(select).not.toHaveBeenCalled()
  })

  it('names the kit in the intro, and only when there is one', async () => {
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(false)

    await runWizard(project())
    expect(intro).toHaveBeenCalledWith(' scaffold ')

    await runWizard(resolveConfig({}, root, null, [], 'wibble'))
    expect(intro).toHaveBeenLastCalledWith(' scaffold · kit: wibble ')
  })

  it('asks name, directory and composition, then writes what it previewed', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue(['story'])
    vi.mocked(confirm).mockResolvedValue(true)

    await runWizard(config)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/components/card.stories.tsx'))).toBe(true)
    expect(vi.mocked(note).mock.calls[0]?.[1]).toBe('Will write 2 files')
    expect(process.exitCode).toBe(0)
  })

  it('never offers the target itself as something to compose', async () => {
    const config = project(['src/components/card.tsx'])
    vi.mocked(select).mockResolvedValue('story')
    vi.mocked(autocomplete).mockResolvedValue('src/components/card.tsx')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(true)

    await runWizard(config)

    const offered = vi.mocked(multiselect).mock.calls[0]?.[0]?.options ?? []
    expect(offered.map((option) => option.value)).not.toContain('component')
    expect(existsSync(join(root, 'src/components/card.stories.tsx'))).toBe(true)
  })

  it('writes into a directory that is not the generator’s default', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/widgets')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(true)

    await runWizard(config)

    expect(existsSync(join(root, 'src/widgets/card.tsx'))).toBe(true)
  })

  it('offers the existing tree as directories, ranked as you type', async () => {
    const config = project(['src/components/card.tsx', 'src/widgets/table.tsx'])
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(false)

    await runWizard(config)

    const options = vi.mocked(autocomplete).mock.calls[0]?.[0]
    if (!options) throw new Error('the directory prompt was never drawn')
    expect(options.filter?.('', '' as never)).toBe(true)
    const offered = optionsOf(options, { userInput: 'widg', focusedValue: '' })
    expect(offered.map((option) => option.value)).toContain('src/widgets')
  })

  it('stops when the plan is refused, before asking to write', async () => {
    const config = project(['src/components/card.tsx'])
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue([])

    await runWizard(config)

    expect(cancelled()).toContain('already exists')
    expect(confirm).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('writes nothing when the preview is declined', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(false)

    await runWizard(config)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(false)
    expect(vi.mocked(cancel)).toHaveBeenCalledWith('Nothing written.')
  })

  it('stops when the target picker had nothing to offer', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('story')

    await runWizard(config)

    expect(multiselect).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('refuses a generator the registry does not have', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('wibble')

    await runWizard(config)

    expect(vi.mocked(cancel)).toHaveBeenCalledWith(
      'There is no "wibble" generator.',
    )
    expect(process.exitCode).toBe(1)
  })

  it('requires a name, and accepts one that is not only whitespace', async () => {
    const config = project()
    vi.mocked(select).mockResolvedValue('component')
    vi.mocked(text).mockResolvedValue('Card')
    vi.mocked(autocomplete).mockResolvedValue('src/components')
    vi.mocked(multiselect).mockResolvedValue([])
    vi.mocked(confirm).mockResolvedValue(false)

    await runWizard(config)

    const prompt = vi.mocked(text).mock.calls[0]?.[0]
    if (!prompt) throw new Error('the name prompt was never drawn')
    expect(validatorOf(prompt)('  ')).toBe('Required')
    expect(validatorOf(prompt)('Card')).toBeUndefined()
  })
})
