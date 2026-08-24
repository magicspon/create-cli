/**
 * The generator registry: what this project can generate, and how to look one
 * up.
 *
 * The built-ins are split into a **core** that assumes nothing beyond React,
 * and **presets** that assume a particular runner — Storybook, browser-mode
 * Vitest, msw. Shipping the presets switched off is what keeps the package
 * usable in a project that has none of them. (ADR 0003)
 *
 * Discovery is not filesystem-based on purpose: `fallow` cannot see dynamic
 * imports, and a glob would trade static analysis away to save one import line.
 * Adding a built-in output type is one template file and one entry below.
 * (ADR 0001)
 */

import { kebabCase, pascalCase } from 'es-toolkit'
import { renderComponent } from '../templates/component.ts'
import { renderHook } from '../templates/hook.ts'
import { renderHookTest } from '../templates/hook-test.ts'
import { renderMswTest } from '../templates/msw-test.ts'
import { renderStory } from '../templates/story.ts'
import { renderTest } from '../templates/test.ts'

/**
 * A generator's id. Open, not a union: a project's own generators are as real
 * as the built-in ones, so nothing here can enumerate them ahead of time.
 */
export type GeneratorId = string

/**
 * The name a run was given, in the casings its files actually need.
 *
 * Deliberately only what something reads today. `es-toolkit` is one import
 * away, so a generator that wants another casing adds it here when it exists,
 * rather than the type carrying fields nothing has ever asked for.
 */
export interface NameCasings {
  /** `data-table` — filenames. */
  kebabName: string
  /** `DataTable` — components, props interfaces, story titles. */
  pascalName: string
  /** `useDataTable` — hook exports. Never doubles an existing `use` prefix. */
  hookName: string
  /** `use-data-table` — hook filenames. Not the same as `kebabName`. */
  kebabHookName: string
}

/** `mouse` and `useMouse` both mean the hook `useMouse`. */
function hookNameOf(pascalName: string): string {
  const base = pascalName.startsWith('Use') ? pascalName.slice(3) : pascalName
  return `use${base || pascalName}`
}

/**
 * Every casing a template or a filename needs, or `null` for a name there is
 * nothing to build one from.
 *
 * Lives here rather than in `plan.ts` because it produces `NameCasings` and
 * because the target picker needs it too — and a picker that imported the
 * planner would point the dependency the wrong way round.
 */
export function casingsOf(name: string): NameCasings | null {
  const kebabName = kebabCase(name)
  if (!kebabName) return null

  const pascalName = pascalCase(name)
  const hookName = hookNameOf(pascalName)

  return {
    kebabName,
    pascalName,
    hookName,
    kebabHookName: kebabCase(hookName),
  }
}

/** Everything a template may use, and the only input it gets. */
export interface TemplateContext extends NameCasings {
  /** Directory the file lands in, relative to the project root. */
  directory: string
  /** Path of the file being rendered, relative to the project root. */
  path: string
  /**
   * Import specifier for this generator's target, relative to the file being
   * rendered. Empty for generators that have no target.
   */
  targetImport: string
  /**
   * The project's configured import specifiers, verbatim from
   * `scaffold.config.ts`. Empty unless the project declares some.
   */
  imports: Record<string, string>
}

/** A named recipe turning a name and a directory into exactly one file. */
export interface Generator {
  id: GeneratorId
  /** Shown in `--help` and in the wizard's generator list. */
  description: string
  /**
   * Key into the config's `directories` supplying this generator's default
   * directory. A key nothing configures falls back to the project root.
   */
  directory: string
  /** The file this generator writes, relative to the resolved directory. */
  fileName: (casings: NameCasings) => string
  /**
   * The generator whose output this one writes *against*. Resolved by
   * co-location — same name, same directory — never by reading the file.
   */
  target?: GeneratorId
  render: (context: TemplateContext) => string
}

/**
 * The core: everything a React project can use without owning a particular
 * test runner or story format.
 */
const core: Array<Generator> = [
  {
    id: 'component',
    description: 'A typed React component',
    directory: 'components',
    fileName: ({ kebabName }) => `${kebabName}.tsx`,
    render: renderComponent,
  },
  {
    id: 'hook',
    description: 'A custom React hook',
    directory: 'hooks',
    fileName: ({ kebabHookName }) => `${kebabHookName}.ts`,
    render: renderHook,
  },
  {
    id: 'test',
    description: 'A Vitest unit test, describe/it, in a node environment',
    directory: 'lib',
    fileName: ({ kebabName }) => `${kebabName}.test.ts`,
    render: renderTest,
  },
]

/**
 * Generators that only make sense once a project has the runner behind them.
 * Enabled by name in `scaffold.config.ts`, e.g. `presets: ['storybook']`.
 */
const presets: Record<string, Array<Generator>> = {
  storybook: [
    {
      id: 'story',
      description: 'A Storybook story for a component beside it',
      directory: 'components',
      fileName: ({ kebabName }) => `${kebabName}.stories.tsx`,
      target: 'component',
      render: renderStory,
    },
  ],
  browser: [
    {
      id: 'hook-test',
      description: 'A Vitest test for a hook beside it, in a real browser',
      directory: 'hooks',
      // The `.browser.` infix is what routes this file to a browser-mode
      // Vitest project, and what keeps it out of the node one.
      fileName: ({ kebabHookName }) => `${kebabHookName}.browser.test.ts`,
      target: 'hook',
      render: renderHookTest,
    },
  ],
  msw: [
    {
      id: 'msw-test',
      description: 'A Vitest test with msw intercepting the network',
      directory: 'lib',
      fileName: ({ kebabName }) => `${kebabName}.msw.test.ts`,
      render: renderMswTest,
    },
  ],
}

/** Every preset name, for naming the ones a typo could have meant. */
const presetNames: Array<string> = Object.keys(presets)

/**
 * The built-in generators for a given preset selection: always the core, plus
 * each named preset's contribution.
 *
 * An unknown preset name throws rather than being skipped — a typo that
 * silently produced fewer generators would read as the tool being broken.
 */
export function builtInGenerators(enabled: Array<string>): Array<Generator> {
  return enabled.reduce<Array<Generator>>(
    (all, name) => {
      const preset = presets[name]
      if (!preset) {
        throw new Error(
          `There is no "${name}" preset. Available: ${presetNames.join(', ')}.`,
        )
      }
      return [...all, ...preset]
    },
    [...core],
  )
}

/** Lookup over the generators one run resolved, built-ins and user ones alike. */
export interface Registry {
  /** Every generator, in the order composed runs execute them. */
  all: Array<Generator>
  /** The generator with this id, or `undefined` for an id nothing registers. */
  find: (id: string) => Generator | undefined
  /** Whether `id` names a registered generator. */
  has: (id: string) => boolean
}

/** Build the lookup for one resolved config. */
export function createRegistry(all: Array<Generator>): Registry {
  const byId = new Map(all.map((generator) => [generator.id, generator]))

  return {
    all,
    find: (id) => byId.get(id),
    has: (id) => byId.has(id),
  }
}
