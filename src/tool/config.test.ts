/**
 * Config resolution — how a project says what it can generate and where those
 * files go, and what a project that says nothing gets.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_DIRECTORIES,
  findPackageRoot,
  isInside,
  loadConfig,
  resolveConfig,
  resolveGenerators,
  sourceRoot,
} from './config.ts'

import type { Generator } from './generators.ts'

let root: string

beforeEach(() => {
  // `realpath` matters on macOS, where `/var` is a symlink to `/private/var`
  // and c12 reports the resolved path while `mkdtemp` returns the link.
  root = mkdtempSync(join(tmpdir(), 'scaffold-config-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writePackage(at: string, pkg: unknown = { name: 'fixture' }): void {
  mkdirSync(at, { recursive: true })
  writeFileSync(join(at, 'package.json'), JSON.stringify(pkg))
}

/** A generator with just enough shape to be registered and looked up. */
function stub(id: string, directory = 'components'): Generator {
  return {
    id,
    description: `a ${id}`,
    directory,
    fileName: ({ kebabName }) => `${kebabName}.ts`,
    render: () => `// ${id}`,
  }
}

describe('findPackageRoot', () => {
  it('finds the nearest package root from a nested working directory', () => {
    writePackage(root, { name: 'outer' })
    const nested = join(root, 'src', 'components', 'deep')
    mkdirSync(nested, { recursive: true })

    expect(findPackageRoot(nested)).toBe(root)
  })

  it('stops at the nearest root, not the outermost one', () => {
    writePackage(root, { name: 'workspace' })
    const inner = join(root, 'packages', 'web')
    writePackage(inner, { name: 'web' })
    const nested = join(inner, 'src', 'components')
    mkdirSync(nested, { recursive: true })

    expect(findPackageRoot(nested)).toBe(inner)
  })

  it('returns the directory itself when it is already a package root', () => {
    writePackage(root, { name: 'here' })
    expect(findPackageRoot(root)).toBe(root)
  })
})

describe('isInside', () => {
  it('counts a directory as inside itself', () => {
    expect(isInside('src/components/ui', 'src/components/ui')).toBe(true)
  })

  it('counts a descendant as inside', () => {
    expect(isInside('src/components/ui/parts', 'src/components/ui')).toBe(true)
  })

  it('does not match on a shared prefix that is not a path boundary', () => {
    expect(isInside('src/components/uikit', 'src/components/ui')).toBe(false)
  })
})

describe('resolveGenerators', () => {
  it('gives the core three when nothing is configured', () => {
    const ids = resolveGenerators({}).map((generator) => generator.id)

    expect(ids).toEqual(['component', 'hook', 'test'])
  })

  it('adds a preset only when it is asked for', () => {
    expect(resolveGenerators({}).map((g) => g.id)).not.toContain('story')

    const ids = resolveGenerators({ presets: ['storybook'] }).map((g) => g.id)
    expect(ids).toContain('story')
  })

  it('throws on a preset name nothing registers, rather than skipping it', () => {
    // A typo that silently produced fewer generators would read as the tool
    // being broken rather than as the config being wrong.
    expect(() => resolveGenerators({ presets: ['storybok'] })).toThrow(
      /storybok/,
    )
  })

  it('drops a built-in the config disables', () => {
    const ids = resolveGenerators({ disable: ['test'] }).map((g) => g.id)

    expect(ids).toEqual(['component', 'hook'])
  })

  it('appends a generator the project defines itself', () => {
    const ids = resolveGenerators({ generators: [stub('route')] }).map(
      (g) => g.id,
    )

    expect(ids).toEqual(['component', 'hook', 'test', 'route'])
  })

  it('replaces a built-in in place when a user generator reuses its id', () => {
    const mine = stub('component')
    const resolved = resolveGenerators({ generators: [mine] })

    // Replaced, not appended: the id appears once, and it is the user's.
    expect(resolved.filter((g) => g.id === 'component')).toHaveLength(1)
    expect(resolved.find((g) => g.id === 'component')).toBe(mine)
    expect(resolved.map((g) => g.id)).toEqual(['component', 'hook', 'test'])
  })

  it('lets disable win over a user generator of the same id', () => {
    const ids = resolveGenerators({
      generators: [stub('route')],
      disable: ['route'],
    }).map((g) => g.id)

    expect(ids).not.toContain('route')
  })
})

describe('resolveConfig', () => {
  it('merges configured directories over the defaults rather than replacing them', () => {
    const config = resolveConfig(
      { directories: { components: 'app/ui' } },
      '/r',
    )

    expect(config.directories.components).toBe('app/ui')
    expect(config.directories.hooks).toBe(DEFAULT_DIRECTORIES.hooks)
  })

  it('defaults protect and format to empty, so nothing is guarded or run unasked', () => {
    const config = resolveConfig({}, '/r')

    expect(config.protect).toEqual([])
    expect(config.format).toEqual([])
  })

  it('exposes the resolved generators as a registry', () => {
    const config = resolveConfig({ generators: [stub('route')] }, '/r')

    expect(config.registry.has('route')).toBe(true)
    expect(config.registry.has('nope')).toBe(false)
    expect(config.registry.find('route')?.description).toBe('a route')
  })
})

describe('sourceRoot', () => {
  it('is the segment every configured directory shares', () => {
    expect(sourceRoot(resolveConfig({}, '/r'))).toBe('src')
  })

  it('is empty when the directories share no single root to search', () => {
    // Nothing sensible to narrow to, so the pickers search the whole project
    // rather than guessing one of the two.
    const config = resolveConfig(
      { directories: { components: 'app/ui', hooks: 'lib/hooks' } },
      '/r',
    )

    expect(sourceRoot(config)).toBe('')
  })
})

describe('loadConfig', () => {
  it('works with no config file at all', async () => {
    writePackage(root)

    const config = await loadConfig(root)

    expect(config.configFile).toBeNull()
    expect(config.directories.components).toBe('src/components')
    expect(config.registry.all.map((g) => g.id)).toEqual([
      'component',
      'hook',
      'test',
    ])
  })

  it('reads a TypeScript config file, which is what makes user templates typed', async () => {
    writePackage(root)
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default {
         presets: ['storybook'] as Array<string>,
         directories: { components: 'app/ui' },
         protect: ['app/ui/vendor'],
       }\n`,
    )

    const config = await loadConfig(root)

    expect(config.directories.components).toBe('app/ui')
    expect(config.protect).toEqual(['app/ui/vendor'])
    expect(config.registry.has('story')).toBe(true)
  })

  it('loads generators a config file defines, into the same registry', async () => {
    writePackage(root)
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default {
         generators: [{
           id: 'route',
           description: 'a route module',
           directory: 'routes',
           fileName: (c) => c.kebabName + '.route.ts',
           render: (c) => 'export const id = "' + c.kebabName + '"\\n',
         }],
         directories: { routes: 'src/routes' },
       }\n`,
    )

    const config = await loadConfig(root)
    const route = config.registry.find('route')

    expect(route).toBeDefined()
    expect(
      route?.fileName({
        kebabName: 'about',
        pascalName: 'About',
        hookName: 'useAbout',
        kebabHookName: 'use-about',
      }),
    ).toBe('about.route.ts')
  })

  it('finds the config file from a nested working directory', async () => {
    writePackage(root)
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default { directories: { components: 'app/ui' } }\n`,
    )
    const nested = join(root, 'src', 'deep')
    mkdirSync(nested, { recursive: true })

    const config = await loadConfig(nested)

    expect(config.directories.components).toBe('app/ui')
  })
})
