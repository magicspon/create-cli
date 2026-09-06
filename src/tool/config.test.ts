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

  it('falls back to the directory itself when there is no package.json at all', () => {
    // A globally installed scaffold pointed at a kit has no reason to require a
    // Node project underneath it. (ADR 0007)
    const nested = join(root, 'notes')
    mkdirSync(nested, { recursive: true })

    expect(findPackageRoot(nested)).toBe(nested)
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

  it('gives a generator naming an unconfigured directory key a path under src', () => {
    // Without this a generator declared in a template file — which by design
    // has no config entry — would write to the project root. (ADR 0006)
    const config = resolveConfig(
      { generators: [{ ...stub('route'), directory: 'routes' }] },
      '/r',
    )

    expect(config.directories.routes).toBe('src/routes')
  })

  it('leaves a directory that was written as a path alone', () => {
    const config = resolveConfig(
      { generators: [{ ...stub('route'), directory: 'app/routes' }] },
      '/r',
    )

    // Never `src/app/routes`.
    expect(config.directories['app/routes']).toBe('app/routes')
  })

  it('still lets the config override a key a generator invented', () => {
    const config = resolveConfig(
      {
        generators: [{ ...stub('route'), directory: 'routes' }],
        directories: { routes: 'app/pages' },
      },
      '/r',
    )

    expect(config.directories.routes).toBe('app/pages')
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

  it('renders a built-in from the template directory when a file matches its id', async () => {
    writePackage(root)
    mkdirSync(join(root, 'scaffold', 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'scaffold', 'templates', 'component.ts'),
      `export default (c) => 'export const ' + c.pascalName + ' = 1\\n'\n`,
    )
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default { templates: 'scaffold/templates' }\n`,
    )

    const config = await loadConfig(root)
    const component = config.registry.find('component')

    expect(
      component?.render({
        kebabName: 'card',
        pascalName: 'Card',
        hookName: 'useCard',
        kebabHookName: 'use-card',
        directory: 'src/components',
        path: 'src/components/card.tsx',
        targetImport: '',
        imports: {},
      }),
    ).toBe('export const Card = 1\n')

    // Only `render` moved: the generator is still the built-in one, so it keeps
    // its place in `--help`, in `--with` and in the wizard.
    expect(
      component?.fileName({
        kebabName: 'card',
        pascalName: 'Card',
        hookName: 'useCard',
        kebabHookName: 'use-card',
      }),
    ).toBe('card.tsx')
    expect(config.registry.all.map((g) => g.id)).toEqual([
      'component',
      'hook',
      'test',
    ])
  })

  it('discovers scaffold/templates with no config file at all', async () => {
    // The whole point of ADR 0006: a project adds a generator by adding a file.
    writePackage(root)
    mkdirSync(join(root, 'scaffold', 'templates'), { recursive: true })
    writeFileSync(
      join(root, 'scaffold', 'templates', 'route.ts'),
      `export default {
         description: 'A route module',
         directory: 'routes',
         fileName: (c) => c.kebabName + '.route.ts',
         render: (c) => 'export const ' + c.pascalName + 'Route = {}\\n',
       }\n`,
    )

    const config = await loadConfig(root)

    expect(config.configFile).toBeNull()
    expect(config.registry.has('route')).toBe(true)
    // Reached `src/routes` without anybody configuring a directory.
    expect(config.directories.routes).toBe('src/routes')
  })

  it('is unaffected by a scaffold/templates that does not exist', async () => {
    writePackage(root)

    const config = await loadConfig(root)

    expect(config.registry.all.map((g) => g.id)).toEqual([
      'component',
      'hook',
      'test',
    ])
  })

  it('still refuses a configured template directory that is missing', async () => {
    // Only ever a typo or a directory not created yet. The conventional one is
    // a lookup; a named one is a promise.
    writePackage(root)
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default { templates: 'nope/templates' }\n`,
    )

    await expect(loadConfig(root)).rejects.toThrow(/does not exist/)
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

describe('kits', () => {
  let home: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'scaffold-kits-config-'))
    process.env.SCAFFOLD_HOME = home
  })

  afterEach(() => {
    delete process.env.SCAFFOLD_HOME
    rmSync(home, { recursive: true, force: true })
  })

  /** A kit of bare template files — no imports, so nothing to resolve. */
  function writeKit(name: string, files: Record<string, string>): void {
    mkdirSync(join(home, name), { recursive: true })
    for (const [file, contents] of Object.entries(files)) {
      writeFileSync(join(home, name, file), contents)
    }
  }

  function writeProjectTemplate(file: string, contents: string): void {
    mkdirSync(join(root, 'scaffold', 'templates'), { recursive: true })
    writeFileSync(join(root, 'scaffold', 'templates', file), contents)
  }

  const casings = {
    kebabName: 'card',
    pascalName: 'Card',
    hookName: 'useCard',
    kebabHookName: 'use-card',
  }

  /**
   * A kit template that declares a generator rather than overriding one, so it
   * carries a `fileName` — the one field a new id cannot inherit. (ADR 0006)
   */
  function declaresRoute(render = '// kit'): string {
    return (
      'export default { fileName: ({ kebabName }) => `${kebabName}.route.ts`,' +
      ` render: () => ${JSON.stringify(render)} }`
    )
  }

  it('does not apply a kit that was not named, however many exist', async () => {
    // Nothing under the kits directory loads because it happens to be there:
    // an always-on kit would change what every repository on the machine
    // scaffolds, with nothing in any of them saying so. (ADR 0007)
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })

    const config = await loadConfig(root)

    expect(config.kit).toBe(null)
    expect(config.registry.has('route')).toBe(false)
  })

  it('registers a generator a kit declares', async () => {
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })

    const config = await loadConfig(root, 'wibble')

    expect(config.kit).toBe('wibble')
    expect(config.registry.has('route')).toBe(true)
    expect(config.registry.find('route')?.fileName(casings)).toBe(
      'card.route.ts',
    )
  })

  it("lets the project's own template override a kit's, field by field", async () => {
    // The point of layering rather than replacing: a bare render in the project
    // wins the render and inherits the kit's fileName, exactly as it would
    // inherit a built-in's. (ADR 0007)
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })
    writeProjectTemplate('route.ts', 'export default () => "// project"')

    const config = await loadConfig(root, 'wibble')
    const route = config.registry.find('route')

    expect(
      route?.render({
        ...casings,
        directory: 'src/routes',
        path: 'src/routes/card.route.ts',
        targetImport: '',
        imports: {},
      }),
    ).toBe('// project')
    expect(route?.fileName(casings)).toBe('card.route.ts')
  })

  it('refuses a kit that does not exist', async () => {
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })

    await expect(loadConfig(root, 'wobble')).rejects.toThrow(
      /no "wobble" kit\. Available: wibble/,
    )
  })

  it('refuses a kit that exists but holds no templates', async () => {
    // Contributing nothing is indistinguishable from passing no kit, and would
    // scaffold the built-in output while looking exactly like success.
    writePackage(root)
    mkdirSync(join(home, 'empty'))

    await expect(loadConfig(root, 'empty')).rejects.toThrow(
      /holds no templates/,
    )
  })

  it('takes the kit from the config file when no flag was passed', async () => {
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default { kit: 'wibble' }\n`,
    )

    const config = await loadConfig(root)

    expect(config.kit).toBe('wibble')
    expect(config.registry.has('route')).toBe(true)
  })

  it('lets the flag win over the config file', async () => {
    // One is what this run asked for; the other is the project's standing answer.
    writePackage(root)
    writeKit('wibble', { 'route.ts': declaresRoute() })
    writeKit('wobble', { 'route.ts': declaresRoute('// other') })
    writeFileSync(
      join(root, 'scaffold.config.ts'),
      `export default { kit: 'wibble' }\n`,
    )

    const config = await loadConfig(root, 'wobble')

    expect(config.kit).toBe('wobble')
  })

  it('refuses a generator called kit, whatever declared it', () => {
    // `scaffold kit` is a subcommand and subcommands are generators, so either
    // one silently winning would shadow the other. (ADR 0007)
    expect(() => resolveConfig({ generators: [stub('kit')] }, '/r')).toThrow(
      /reserved/,
    )
  })

  it('refuses a kit.ts template for its name, not for its missing fileName', () => {
    // Checked before the layers are applied. Otherwise a bare `kit.ts` is
    // refused by ADR 0006's rule first, and the message names the wrong
    // problem — the one that would still be there after fixing it.
    expect(() =>
      resolveConfig({}, '/r', null, [{ kit: { render: () => '' } }]),
    ).toThrow(/reserved/)
  })
})
