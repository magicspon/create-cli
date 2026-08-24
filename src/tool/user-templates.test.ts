/**
 * Templates supplied as files in a directory — which filenames count, which
 * generator each one overrides, and what a file that matches nothing does.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyTemplates,
  loadTemplates,
  templateFilesIn,
  templateFrom,
  templateIdOf,
} from './user-templates.ts'

import type { Generator, NameCasings } from './generators.ts'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-templates-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** A generator with just enough shape to be overridden and rendered. */
function stub(id: string): Generator {
  return {
    id,
    description: `a ${id}`,
    directory: 'components',
    fileName: ({ kebabName }) => `${kebabName}.ts`,
    render: () => `// built-in ${id}`,
  }
}

const casings: NameCasings = {
  kebabName: 'card',
  pascalName: 'Card',
  hookName: 'useCard',
  kebabHookName: 'use-card',
}

/** The one argument every template in these tests receives. */
const context = {
  ...casings,
  directory: 'src/components',
  path: 'src/components/card.tsx',
  targetImport: '',
  imports: {},
}

/** Write a template directory with the given files, and return its name. */
function writeTemplates(files: Record<string, string>, at = 'templates') {
  mkdirSync(join(root, at), { recursive: true })
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(root, at, name), contents)
  }
  return at
}

describe('templateIdOf', () => {
  it('reads the generator id off the filename, extension stripped', () => {
    expect(templateIdOf('component.ts')).toBe('component')
    expect(templateIdOf('hook-test.tsx')).toBe('hook-test')
    expect(templateIdOf('msw-test.mjs')).toBe('msw-test')
  })

  it('ignores a file with an extension that is not code', () => {
    expect(templateIdOf('component.njk')).toBeNull()
    expect(templateIdOf('README.md')).toBeNull()
  })

  it('ignores an underscored file, which is how helpers live alongside', () => {
    expect(templateIdOf('_shared.ts')).toBeNull()
  })

  it('ignores dotfiles and declaration files', () => {
    expect(templateIdOf('.DS_Store')).toBeNull()
    expect(templateIdOf('component.d.ts')).toBeNull()
  })
})

describe('templateFilesIn', () => {
  it('keys the code files by the generator each one claims', () => {
    const files = templateFilesIn([
      'component.ts',
      'hook.tsx',
      '_shared.ts',
      'notes.md',
    ])

    expect([...files]).toEqual([
      ['component', 'component.ts'],
      ['hook', 'hook.tsx'],
    ])
  })

  it('throws when two files claim one generator, rather than picking one', () => {
    // Which one won would otherwise depend on readdir order, and a generator
    // rendering from the wrong file is worse than a refusal.
    expect(() => templateFilesIn(['component.tsx', 'component.ts'])).toThrow(
      /both templates for "component"/,
    )
  })
})

describe('templateFrom', () => {
  it('takes the default export', () => {
    const render = templateFrom({ default: () => 'from default' }, 'c.ts')

    expect(render(context)).toBe('from default')
  })

  it('takes a named `render`, so a template moved out of a config still works', () => {
    const render = templateFrom({ render: () => 'from render' }, 'c.ts')

    expect(render(context)).toBe('from render')
  })

  it('names the file when it exports no function at all', () => {
    expect(() => templateFrom({ nope: 1 }, 'templates/component.ts')).toThrow(
      /templates\/component\.ts exports no template function/,
    )
  })
})

describe('applyTemplates', () => {
  it('replaces the render of the generator with a matching id', () => {
    const [component, hook] = applyTemplates(
      [stub('component'), stub('hook')],
      { component: () => '// mine' },
    )

    expect(component?.render(context)).toBe('// mine')
    expect(hook?.render(context)).toBe('// built-in hook')
  })

  it('replaces only the render, leaving placement alone', () => {
    // A project wanting a different filename or directory is describing a
    // different generator, and says so in `generators`.
    const [component] = applyTemplates([stub('component')], {
      component: () => '// mine',
    })

    expect(component?.fileName(casings)).toBe('card.ts')
    expect(component?.directory).toBe('components')
    expect(component?.description).toBe('a component')
  })

  it('is a no-op when there are no templates', () => {
    const generators = [stub('component')]

    expect(applyTemplates(generators, {})[0]?.render(context)).toBe(
      '// built-in component',
    )
  })

  it('overrides a generator the project defined itself, not just a built-in', () => {
    const [route] = applyTemplates([stub('route')], { route: () => '// mine' })

    expect(route?.render(context)).toBe('// mine')
  })

  it('throws on a template matching no generator, naming what is available', () => {
    // Silently skipping it would read as the override not working — the file
    // still lands, it is just the wrong file.
    expect(() =>
      applyTemplates([stub('component')], { componant: () => '' }),
    ).toThrow(/no "componant" generator.*Available: component/s)
  })
})

describe('loadTemplates', () => {
  it('loads a TypeScript template file, typed against the context it receives', async () => {
    const directory = writeTemplates({
      'component.ts': `import type { TemplateContext } from '@magicspon/scaffold'
         export default (c: TemplateContext) => 'export const ' + c.pascalName + ' = 1\\n'\n`,
    })

    const templates = await loadTemplates(directory, root)

    expect(templates.component?.(context)).toBe('export const Card = 1\n')
  })

  it('skips the files that are not templates', async () => {
    const directory = writeTemplates({
      'hook.ts': `export default () => '// hook'\n`,
      '_shared.ts': `export const indent = '  '\n`,
      'README.md': `not a template\n`,
    })

    const templates = await loadTemplates(directory, root)

    expect(Object.keys(templates)).toEqual(['hook'])
  })

  it('resolves an import of a helper beside it', async () => {
    const directory = writeTemplates({
      '_shared.ts': `export const banner = '// generated\\n'\n`,
      'component.ts': `import { banner } from './_shared.ts'
         export default () => banner\n`,
    })

    const templates = await loadTemplates(directory, root)

    expect(templates.component?.(context)).toBe('// generated\n')
  })

  it('returns nothing for a directory that holds no templates', async () => {
    const directory = writeTemplates({ 'notes.md': 'nothing here\n' })

    expect(await loadTemplates(directory, root)).toEqual({})
  })

  it('throws for a configured directory that does not exist', async () => {
    // Only ever a typo or a directory not created yet, and both are better said
    // out loud than answered with built-in output.
    await expect(loadTemplates('scaffold/templates', root)).rejects.toThrow(
      /"scaffold\/templates" does not exist/,
    )
  })

  it('names the file when a template throws on import', async () => {
    const directory = writeTemplates({
      'component.ts': `throw new Error('boom')\n`,
    })

    await expect(loadTemplates(directory, root)).rejects.toThrow(
      /templates\/component\.ts could not be loaded: boom/,
    )
  })
})
