/**
 * The argumentless path.
 *
 * Each case is one run of the wizard with its answers queued in advance, and
 * the assertion is on what reached the disk — the point of the wizard being
 * that it ends in the same `execute` as the flags, so answering four prompts
 * and typing four flags cannot diverge.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
import {
  createProject,
  optionsOf,
  restoreTTY,
  setTTY,
  validatorOf,
} from './testing.ts'
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

/** A project containing exactly these files, relative to its root. */
function project(files: Array<string> = [], user = {}): ScaffoldConfig {
  return createProject(root, files, user)
}

/**
 * Queue the wizard's answers, in the order it asks for them. Every prompt is
 * answered whether or not this case reaches it, so a test only names the
 * answer it is actually about.
 */
function answers({
  generator,
  name = 'Card',
  directory = 'src/components',
  compose = [],
  write = false,
}: {
  generator: string
  name?: string
  directory?: string
  compose?: Array<string>
  write?: boolean
}): void {
  vi.mocked(select).mockResolvedValue(generator)
  vi.mocked(text).mockResolvedValue(name)
  vi.mocked(autocomplete).mockResolvedValue(directory)
  vi.mocked(multiselect).mockResolvedValue(compose)
  vi.mocked(confirm).mockResolvedValue(write)
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
  restoreTTY()
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
    answers({ generator: 'component' })

    await runWizard(project())
    expect(intro).toHaveBeenCalledWith(' scaffold ')

    await runWizard(resolveConfig({}, root, null, [], 'wibble'))
    expect(intro).toHaveBeenLastCalledWith(' scaffold · kit: wibble ')
  })

  it('asks name, directory and composition, then writes what it previewed', async () => {
    const config = project()
    answers({ generator: 'component', compose: ['story'], write: true })

    await runWizard(config)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/components/card.stories.tsx'))).toBe(true)
    expect(vi.mocked(note).mock.calls[0]?.[1]).toBe('Will write 2 files')
    expect(process.exitCode).toBe(0)
  })

  it('offers the project root for a directory key nothing configures', async () => {
    // The prompt's placeholder and the "was this the default?" test have to
    // agree, or accepting the default would stop meaning what omitting
    // `--dir` means.
    const config = project()
    answers({ generator: 'component', directory: '.', write: true })

    await runWizard({ ...config, directories: {} })

    expect(vi.mocked(autocomplete).mock.calls[0]?.[0]?.placeholder).toBe('.')
    expect(existsSync(join(root, 'card.tsx'))).toBe(true)
  })

  it('never offers the target itself as something to compose', async () => {
    const config = project(['src/components/card.tsx'])
    answers({
      generator: 'story',
      directory: 'src/components/card.tsx',
      write: true,
    })

    await runWizard(config)

    const offered = vi.mocked(multiselect).mock.calls[0]?.[0]?.options ?? []
    expect(offered.map((option) => option.value)).not.toContain('component')
    expect(existsSync(join(root, 'src/components/card.stories.tsx'))).toBe(true)
  })

  it('writes into a directory that is not the generator’s default', async () => {
    const config = project()
    answers({ generator: 'component', directory: 'src/widgets', write: true })

    await runWizard(config)

    expect(existsSync(join(root, 'src/widgets/card.tsx'))).toBe(true)
  })

  it('offers the existing tree as directories, ranked as you type', async () => {
    const config = project(['src/components/card.tsx', 'src/widgets/table.tsx'])
    answers({ generator: 'component' })

    await runWizard(config)

    const options = vi.mocked(autocomplete).mock.calls[0]?.[0]
    if (!options) throw new Error('the directory prompt was never drawn')
    expect(options.filter?.('', '' as never)).toBe(true)
    const offered = optionsOf(options, { userInput: 'widg', focusedValue: '' })
    expect(offered.map((option) => option.value)).toContain('src/widgets')
  })

  it('stops when the plan is refused, before asking to write', async () => {
    const config = project(['src/components/card.tsx'])
    answers({ generator: 'component' })

    await runWizard(config)

    expect(cancelled()).toContain('already exists')
    expect(confirm).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('writes nothing when the preview is declined', async () => {
    const config = project()
    answers({ generator: 'component' })

    await runWizard(config)

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(false)
    expect(vi.mocked(cancel)).toHaveBeenCalledWith('Nothing written.')
  })

  it('stops when the target picker had nothing to offer', async () => {
    const config = project()
    answers({ generator: 'story' })

    await runWizard(config)

    expect(multiselect).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('refuses a generator the registry does not have', async () => {
    const config = project()
    answers({ generator: 'wibble' })

    await runWizard(config)

    expect(vi.mocked(cancel)).toHaveBeenCalledWith(
      'There is no "wibble" generator.',
    )
    expect(process.exitCode).toBe(1)
  })

  it('requires a name, and accepts one that is not only whitespace', async () => {
    const config = project()
    answers({ generator: 'component' })

    await runWizard(config)

    const prompt = vi.mocked(text).mock.calls[0]?.[0]
    if (!prompt) throw new Error('the name prompt was never drawn')
    expect(validatorOf(prompt)('  ')).toBe('Required')
    expect(validatorOf(prompt)('Card')).toBeUndefined()
  })
})
