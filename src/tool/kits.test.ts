/**
 * Kits — where they live, which names are names, and what a missing one does.
 *
 * `SCAFFOLD_HOME` is the seam: every test here points it at a temporary
 * directory rather than mocking `homedir()`, which is the reason the variable
 * exists. (ADR 0007)
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { builtInGenerators, presetNames } from './generators.ts'
import {
  createKit,
  isKitInvocation,
  isKitName,
  kitFromArgv,
  kitsDirectory,
  kitTemplateFile,
  templateSourceDirectory,
  listKits,
  resolveKit,
  selfAlias,
} from './kits.ts'

/** The built-in template file a generator id is copied from. */
function sourceOf(id: string): string {
  return join(import.meta.dirname, '../templates', `${id}.ts`)
}

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'scaffold-kits-'))
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  // The `selfAlias` fallback case mocks jiti for itself alone.
  vi.doUnmock('jiti')
  vi.resetModules()
})

describe('kitsDirectory', () => {
  it('is .scaffold inside the home directory by default', () => {
    expect(kitsDirectory({}, '/home/someone')).toBe('/home/someone/.scaffold')
  })

  it('is whatever SCAFFOLD_HOME names, which is the kits directory itself', () => {
    // Not a home directory *containing* one — `CARGO_HOME` is `~/.cargo`.
    expect(kitsDirectory({ SCAFFOLD_HOME: '/tmp/kits' }, '/home/someone')).toBe(
      '/tmp/kits',
    )
  })

  it('ignores a blank SCAFFOLD_HOME rather than resolving kits to nowhere', () => {
    expect(kitsDirectory({ SCAFFOLD_HOME: '  ' }, '/home/someone')).toBe(
      '/home/someone/.scaffold',
    )
  })
})

describe('isKitName', () => {
  it('accepts an ordinary name', () => {
    expect(isKitName('wibble')).toBe(true)
    expect(isKitName('my-kit_2.0')).toBe(true)
  })

  it('refuses anything that could climb out of the kits directory', () => {
    expect(isKitName('..')).toBe(false)
    expect(isKitName('../etc')).toBe(false)
    expect(isKitName('a/b')).toBe(false)
  })

  it('refuses the next flag along, which is what `--kit --dry-run` hands us', () => {
    expect(isKitName('--dry-run')).toBe(false)
  })
})

describe('kitFromArgv', () => {
  it('reads both spellings, wherever they appear', () => {
    expect(kitFromArgv(['component', '--kit', 'wibble', 'Card'])).toBe('wibble')
    expect(kitFromArgv(['component', 'Card', '--kit=wibble'])).toBe('wibble')
  })

  it('is null when no kit was named', () => {
    expect(kitFromArgv(['component', 'Card', '--dry-run'])).toBe(null)
  })

  it('hands on the next flag rather than swallowing the mistake', () => {
    // Refused downstream by `isKitName`, which can say what was wrong with it.
    expect(kitFromArgv(['component', '--kit', '--dry-run'])).toBe('--dry-run')
  })

  it('is null for a trailing --kit with nothing after it', () => {
    expect(kitFromArgv(['component', '--kit'])).toBe(null)
    expect(kitFromArgv(['component', '--kit='])).toBe(null)
  })
})

describe('isKitInvocation', () => {
  it('is true for the kit subcommand, however the flags fall', () => {
    expect(isKitInvocation(['kit', 'ls'])).toBe(true)
    expect(isKitInvocation(['--verbose', 'kit', 'new', 'wibble'])).toBe(true)
  })

  it('is false for a generator run, including one naming a kit', () => {
    expect(isKitInvocation(['component', 'Card'])).toBe(false)
    expect(isKitInvocation(['component', 'Card', '--kit', 'wibble'])).toBe(
      false,
    )
    expect(isKitInvocation(['--kit', 'wibble'])).toBe(false)
  })

  it('is false for no arguments at all, which is the wizard', () => {
    expect(isKitInvocation([])).toBe(false)
  })
})

describe('listKits', () => {
  it('is empty when the kits directory does not exist at all', () => {
    expect(listKits(join(home, 'nope'))).toEqual([])
  })

  it('lists directories, sorted, ignoring files and dot entries', () => {
    mkdirSync(join(home, 'zebra'))
    mkdirSync(join(home, 'apple'))
    mkdirSync(join(home, '.DS_Store_dir'))

    expect(listKits(home)).toEqual(['apple', 'zebra'])
  })
})

describe('resolveKit', () => {
  it('resolves a kit that exists', () => {
    mkdirSync(join(home, 'wibble'))
    expect(resolveKit('wibble', home)).toBe(join(home, 'wibble'))
  })

  it('refuses a missing kit and names the ones that exist', () => {
    mkdirSync(join(home, 'wibble'))

    expect(() => resolveKit('wobble', home)).toThrow(
      /no "wobble" kit\. Available: wibble/,
    )
  })

  it('points at `kit new` when there are no kits at all', () => {
    expect(() => resolveKit('wibble', home)).toThrow(/scaffold kit new wibble/)
  })

  it('refuses a name that is not a name before it touches the disk', () => {
    expect(() => resolveKit('../../etc', home)).toThrow(/is not a kit name/)
  })
})

describe('createKit', () => {
  it('seeds a kit that runs immediately and typechecks after an install', () => {
    const { path, templates } = createKit('wibble', home)

    // The copied core is what stops a brand new kit refusing the next run for
    // being empty.
    expect(templates).toEqual(['component.ts', 'hook.ts', 'test.ts'])
    expect(existsSync(join(path, 'package.json'))).toBe(true)
    expect(existsSync(join(path, 'tsconfig.json'))).toBe(true)
  })

  it('copies a preset only when it is named', () => {
    // A kit applies to every project that adopts it, so seeding `story.ts`
    // unasked would hand a project with no Storybook a `story` generator.
    // (ADR 0003)
    const { templates } = createKit('wibble', home, ['storybook'])

    expect(templates).toContain('story.ts')
    expect(createKit('wobble', home).templates).not.toContain('story.ts')
  })

  it('copies the built-in template itself, not a paraphrase of it', () => {
    const { path } = createKit('wibble', home)
    const seeded = readFileSync(join(path, 'component.ts'), 'utf8')
    const source = readFileSync(sourceOf('component'), 'utf8')

    // Word for word, comments and all, so a seeded kit starts from what the
    // tool would really have emitted and there is no second copy to drift.
    const render = source.slice(source.indexOf('export function'))
    expect(seeded).toContain(render)

    // The one thing that has to change: a path inside this package is not
    // resolvable from `~/.scaffold`. (ADR 0007)
    expect(seeded).toContain("from '@magicspon/create-cli'")
    expect(seeded).not.toContain('../tool/generators.ts')
  })

  it('refuses an unknown preset before it writes anything', () => {
    // Otherwise the typo leaves a half-seeded kit the retry refuses as
    // already existing.
    expect(() => createKit('wibble', home, ['wobble'])).toThrow(
      /no "wobble" preset/,
    )
    expect(existsSync(join(home, 'wibble'))).toBe(false)
  })

  it('refuses a kit that already exists rather than writing over it', () => {
    createKit('wibble', home)
    expect(() => createKit('wibble', home)).toThrow(/already exists/)
  })

  it('refuses a name that could write outside the kits directory', () => {
    expect(() => createKit('../evil', home)).toThrow(/is not a kit name/)
    expect(existsSync(join(home, '..', 'evil'))).toBe(false)
  })
})

describe('kitTemplateFile', () => {
  it('spells the config out in full, so the file declares as well as overrides', () => {
    // A kit is adopted by projects that never enabled the preset a template
    // came from, and a filename naming no existing generator needs a
    // `fileName` of its own. (ADR 0006)
    const story = builtInGenerators(['storybook']).find(
      (generator) => generator.id === 'story',
    )
    if (!story) throw new Error('the storybook preset declares no story')

    const file = kitTemplateFile(story, 'export function renderStory() {}\n')

    expect(file).toContain("description: 'A Storybook story for a component")
    expect(file).toContain("directory: 'components'")
    expect(file).toContain('fileName: ({ kebabName }) =>')
    expect(file).toContain("target: 'component'")
    expect(file).toContain('  renderStory,')
  })

  it('names a template it cannot find a render in', () => {
    const [component] = builtInGenerators([])
    if (!component) throw new Error('the core declares no generators')

    expect(() => kitTemplateFile(component, 'const nothing = 1\n')).toThrow(
      /exports no render function/,
    )
  })

  it('finds the built-in templates in both shapes the package has', () => {
    // Beside this module in development, and under `src/` from the bundled
    // `dist/index.mjs` once published. (ADR 0004)
    const templates = join(home, 'src', 'templates')
    mkdirSync(templates, { recursive: true })

    // `dist/index.mjs`, reaching the sources published beside it.
    expect(templateSourceDirectory(join(home, 'dist'))).toBe(templates)
    // `src/tool/kits.ts`, reaching the directory next door.
    expect(templateSourceDirectory(join(home, 'src', 'tool'))).toBe(templates)
  })

  it('says the install is broken rather than seeding an empty kit', () => {
    expect(() => templateSourceDirectory(join(home, 'a', 'b'))).toThrow(
      /built-in templates are missing/,
    )
  })

  it('has a source file for every built-in generator', () => {
    // The copy resolves `src/templates/<id>.ts` by convention rather than by a
    // field on `Generator`, so the convention is pinned here rather than
    // discovered by a user whose `kit new` half succeeded. (ADR 0001)
    const every = builtInGenerators(presetNames)

    for (const generator of every) {
      expect(
        existsSync(sourceOf(generator.id)),
        `${generator.id} has no template file`,
      ).toBe(true)
    }
  })
})

describe('selfAlias', () => {
  it('resolves this package from where the tool is, not from the caller', () => {
    // Without this a kit template cannot import `defineTemplate`, so it can
    // only ever override a built-in generator and never declare one.
    const alias = selfAlias()

    expect(Object.keys(alias)).toEqual(['@magicspon/create-cli'])
    expect(alias['@magicspon/create-cli']).toMatch(/define-config/)
  })

  it('aliases nothing rather than throwing when we cannot resolve ourselves', async () => {
    // Survivable on purpose: a kit template importing nothing still runs, and
    // one that does fails by name rather than silently rendering something
    // else. (ADR 0007)
    vi.doMock('jiti', () => ({
      createJiti: () => ({
        esmResolve: () => {
          throw new Error('cannot resolve')
        },
      }),
    }))
    vi.resetModules()

    const { selfAlias: isolated } = await import('./kits.ts')

    expect(isolated()).toEqual({})
  })
})
