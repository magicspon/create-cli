/**
 * The commands, one layer below citty.
 *
 * Everything here is called the way the entry point calls it, against a real
 * temporary project — the point being that `scaffold component Card` and the
 * wizard end in the same `execute`, so the cases worth asserting are the ones
 * only the flags can reach: `--with`, a name that was not given, and a config
 * file that throws.
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
import { text } from '@clack/prompts'
import {
  createMain,
  kitCommand,
  loadCliConfig,
  parseWith,
  resolveChoice,
  runGenerator,
  runKitLs,
  runKitNew,
  subCommandFor,
} from './cli.ts'
import { resolveConfig } from './config.ts'

import type { CommandDef } from 'citty'
import type { MockInstance } from 'vitest'
import type { Generator } from './generators.ts'
import type { ScaffoldConfig } from './config.ts'

vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  isCancel: () => false,
}))

let root: string
let kits: string
let config: ScaffoldConfig
let log: MockInstance<typeof console.log>
let error: MockInstance<typeof console.error>

/** A project containing exactly these files, plus a `package.json`. */
function project(files: Array<string> = [], user = {}): ScaffoldConfig {
  writeFileSync(join(root, 'package.json'), '{}')
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true })
    writeFileSync(join(root, file), '')
  }

  return resolveConfig({ presets: ['storybook'], ...user }, root)
}

function generatorNamed(id: string, scaffold: ScaffoldConfig): Generator {
  const generator = scaffold.registry.find(id)
  if (!generator) throw new Error(`no "${id}" generator`)
  return generator
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

/** Run a citty command's handler without going through argv parsing. */
async function invoke(
  command: { run?: (context: never) => unknown },
  args: Record<string, unknown>,
): Promise<void> {
  await command.run?.({ args } as never)
}

/** A prompt's validator, which clack types as "a function or a schema". */
function validatorOf(prompt: {
  validate?: unknown
}): (value: string) => string | undefined {
  return prompt.validate as (value: string) => string | undefined
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-cli-'))
  kits = mkdtempSync(join(tmpdir(), 'scaffold-kits-'))
  vi.stubEnv('SCAFFOLD_HOME', kits)
  vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  vi.spyOn(process.stdin, 'unref').mockReturnValue(process.stdin)
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
  setTTY(false)
  process.exitCode = undefined
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(kits, { recursive: true, force: true })
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.mocked(text).mockReset()
  if (originalTTY.stdin) {
    Object.defineProperty(process.stdin, 'isTTY', originalTTY.stdin)
  }
  if (originalTTY.stdout) {
    Object.defineProperty(process.stdout, 'isTTY', originalTTY.stdout)
  }
  process.exitCode = undefined
})

describe('parseWith', () => {
  it('reads repeated flags and comma-separated lists as the same run', () => {
    const registry = project().registry

    expect(parseWith('story,test', registry)).toEqual({
      ids: ['story', 'test'],
    })
    expect(parseWith(['story', 'test'], registry)).toEqual({
      ids: ['story', 'test'],
    })
    expect(parseWith(' story , test ', registry)).toEqual({
      ids: ['story', 'test'],
    })
  })

  it('reads an absent flag as an empty run', () => {
    const registry = project().registry

    expect(parseWith(undefined, registry)).toEqual({ ids: [] })
    expect(parseWith('', registry)).toEqual({ ids: [] })
    expect(parseWith(true, registry)).toEqual({ ids: [] })
  })

  it('names every unknown generator, and what there was to choose from', () => {
    const registry = project().registry

    const one = parseWith('storyy', registry)
    expect(one).toHaveProperty('error')
    if ('error' in one) {
      expect(one.error).toContain('Unknown generator: storyy')
      expect(one.error).toContain('Available: component, hook, test, story.')
    }

    const two = parseWith('storyy,tst', registry)
    if ('error' in two)
      expect(two.error).toContain('Unknown generators: storyy, tst')
  })
})

describe('kit commands', () => {
  it('creates a kit and says how to use it', () => {
    runKitNew('wibble', kits)

    expect(existsSync(join(kits, 'wibble'))).toBe(true)
    expect(log.mock.calls.join('\n')).toContain('--kit wibble')
    expect(process.exitCode).toBeUndefined()
  })

  it('refuses a name that is not a kit name', () => {
    runKitNew('../evil', kits)

    expect(error.mock.calls.join(' ')).toContain('is not a kit name')
    expect(process.exitCode).toBe(1)
  })

  it('lists the kits there are, one per line', () => {
    runKitNew('alpha', kits)
    runKitNew('beta', kits)
    log.mockClear()

    runKitLs(kits)

    expect(log.mock.calls[0]?.[0]).toBe('alpha\nbeta')
  })

  it('says where kits would go when there are none', () => {
    runKitLs(kits)

    expect(log.mock.calls.join(' ')).toContain(`No kits in ${kits}`)
  })

  it('wires both subcommands to the kits directory', async () => {
    const subCommands = kitCommand.subCommands as Record<string, CommandDef>
    const create = subCommands.new
    const list = subCommands.ls
    if (!create || !list) throw new Error('the kit subcommands are missing')

    await invoke(create, { name: 'wibble' })
    log.mockClear()
    await invoke(list, {})

    expect(existsSync(join(kits, 'wibble'))).toBe(true)
    expect(log.mock.calls[0]?.[0]).toBe('wibble')
  })
})

describe('resolveChoice', () => {
  it('takes the name it was given without asking anything', async () => {
    config = project()

    expect(
      await resolveChoice(
        'Card',
        generatorNamed('component', config),
        config,
        undefined,
      ),
    ).toEqual({ name: 'Card' })
    expect(text).not.toHaveBeenCalled()
  })

  it('demands a name rather than hanging on a prompt nobody can see', async () => {
    config = project()

    expect(
      await resolveChoice(
        '  ',
        generatorNamed('component', config),
        config,
        undefined,
      ),
    ).toBeNull()
    expect(error.mock.calls.join(' ')).toContain('needs a name')
    expect(process.exitCode).toBe(1)
  })

  it('asks for a name when there is a terminal to ask in', async () => {
    config = project()
    setTTY(true)
    vi.mocked(text).mockResolvedValue('Card')

    expect(
      await resolveChoice(
        undefined,
        generatorNamed('component', config),
        config,
        undefined,
      ),
    ).toEqual({ name: 'Card' })

    const prompt = vi.mocked(text).mock.calls[0]?.[0]
    if (!prompt) throw new Error('the name prompt was never drawn')
    expect(validatorOf(prompt)('  ')).toBe('Required')
    expect(validatorOf(prompt)('Card')).toBeUndefined()
  })

  it('points a targeted generator at a file instead of asking for a name', async () => {
    config = project(['src/components/card.tsx'])
    setTTY(true)

    // The picker's own cases live in `pick.test.ts`; what matters here is that
    // a generator with a target reaches it at all.
    expect(
      await resolveChoice(
        undefined,
        generatorNamed('story', config),
        config,
        'src/nowhere',
      ),
    ).toBeNull()
    expect(text).not.toHaveBeenCalled()
  })
})

describe('runGenerator', () => {
  it('writes the generator and everything composed with it', async () => {
    config = project()

    await runGenerator(generatorNamed('component', config), config, {
      name: 'Card',
      with: 'story',
    })

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/components/card.stories.tsx'))).toBe(true)
    expect(process.exitCode).toBe(0)
  })

  it('refuses a mistyped --with before planning anything', async () => {
    config = project()

    await runGenerator(generatorNamed('component', config), config, {
      name: 'Card',
      with: 'storyy',
    })

    expect(error.mock.calls.join(' ')).toContain('Unknown generator: storyy')
    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(false)
    expect(process.exitCode).toBe(1)
  })

  it('honours --dir, --dry-run and --force', async () => {
    config = project()

    await runGenerator(generatorNamed('component', config), config, {
      name: 'Card',
      dir: 'src/widgets',
      'dry-run': true,
    })
    expect(existsSync(join(root, 'src/widgets/card.tsx'))).toBe(false)
    expect(log.mock.calls.join('\n')).toContain('src/widgets/card.tsx')

    await runGenerator(generatorNamed('component', config), config, {
      name: 'Card',
      dir: 'src/widgets',
    })
    await runGenerator(generatorNamed('component', config), config, {
      name: 'Card',
      dir: 'src/widgets',
      force: true,
    })
    expect(process.exitCode).toBe(0)
  })

  it('stops without a failure when the name was never resolved', async () => {
    config = project()

    await runGenerator(generatorNamed('component', config), config, {})

    expect(process.exitCode).toBe(1)
    expect(existsSync(join(root, 'src/components'))).toBe(false)
  })
})

describe('subCommandFor', () => {
  it('describes the flags in terms of this generator', () => {
    config = project()
    const command = subCommandFor(generatorNamed('component', config), config)

    expect(command.meta).toEqual({
      name: 'component',
      description: 'A typed React component',
    })
    const args = command.args as Record<string, { description?: string }>
    expect(args.dir?.description).toContain('src/components')
    expect(args.with?.description).toContain('hook, test, story')
    // Declared only so citty does not read its value as the positional.
    expect(args.kit).toBeDefined()
  })

  it('falls back to the project root for a generator nothing configures', () => {
    const scaffold = resolveConfig({}, root)
    const generator: Generator = {
      id: 'route',
      description: 'A route',
      directory: 'app/routes',
      fileName: ({ kebabName }) => `${kebabName}.ts`,
      render: () => '',
    }

    const args = subCommandFor(generator, scaffold).args as Record<
      string,
      { description?: string }
    >
    expect(args.dir?.description).toBe('Target directory (default: .)')
  })

  it('runs the generator it was built for', async () => {
    config = project()

    await invoke(subCommandFor(generatorNamed('component', config), config), {
      name: 'Card',
    })

    expect(existsSync(join(root, 'src/components/card.tsx'))).toBe(true)
  })
})

describe('createMain', () => {
  it('gives every generator a subcommand, plus kit', () => {
    config = project()
    const subCommands = createMain(config).subCommands as Record<
      string,
      unknown
    >

    expect(Object.keys(subCommands)).toEqual([
      'component',
      'hook',
      'test',
      'story',
      'kit',
    ])
  })

  it('drops into the wizard when there is no subcommand, and not otherwise', async () => {
    config = project()
    const main = createMain(config)

    expect(
      await main.run?.({ args: { _: ['component'] } } as never),
    ).toBeUndefined()
    expect(error).not.toHaveBeenCalled()

    // Without a terminal the wizard refuses, which is how we know it was reached.
    await main.run?.({ args: { _: [] } } as never)
    expect(error.mock.calls.join(' ')).toContain('needs a terminal')
  })
})

describe('loadCliConfig', () => {
  it('resolves the project’s config for the directory it was run in', async () => {
    project()

    const loaded = await loadCliConfig([], root)

    expect(loaded.root).toBe(root)
    expect(loaded.kit).toBeNull()
  })

  it('reads --kit before there is a command to parse it with', async () => {
    project()
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })

    await expect(
      loadCliConfig(['component', '--kit', 'nope'], root),
    ).rejects.toThrow('process.exit')
    expect(error.mock.calls.join(' ')).toContain('There is no "nope" kit')
  })

  it('keeps `scaffold kit` working when the kit it names is broken', async () => {
    project()

    const loaded = await loadCliConfig(['kit', 'ls', '--kit', 'nope'], root)

    expect(loaded.root).toBe(root)
    expect(loaded.registry.all.map((generator) => generator.id)).toEqual([
      'component',
      'hook',
      'test',
    ])
    expect(error).not.toHaveBeenCalled()
  })
})
