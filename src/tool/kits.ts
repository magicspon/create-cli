/**
 * Kits — template directories in the user's home directory rather than in a
 * project, so one set of generators can serve every repository on the machine.
 *
 * A kit is a template directory and nothing else: the same thing
 * `scaffold/templates` already is, somewhere else. It is never loaded unless it
 * is named, because a kit that applied by itself would change what every
 * repository on the machine scaffolds with nothing in any of them saying so.
 * (ADR 0007)
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attempt } from 'es-toolkit'
import { createJiti } from 'jiti'
import { builtInGenerators } from './generators.ts'

import type { Generator } from './generators.ts'

/**
 * Reserved. `scaffold kit` is a subcommand and subcommands are generators, so a
 * generator of this id would shadow the management commands or be shadowed by
 * them — and picking a winner by load order is what this codebase has refused
 * every previous time the question came up. (ADR 0007)
 */
export const KIT_COMMAND = 'kit'

/** Our own name, aliased so a kit template can import `defineTemplate`. */
const PACKAGE_NAME = '@magicspon/create-cli'

/**
 * Where kits live: `~/.scaffold`, or whatever `SCAFFOLD_HOME` names.
 *
 * The variable points at the kits directory itself rather than at a home
 * directory containing one — the way `CARGO_HOME` and `PNPM_HOME` do — and
 * exists so the tests can point somewhere temporary without reproducing
 * `homedir()`.
 */
export function kitsDirectory(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  return env.SCAFFOLD_HOME?.trim() || join(home, '.scaffold')
}

/**
 * Every kit in `directory`, sorted. Dot-prefixed entries belong to the OS and
 * the editor, as they do inside a template directory.
 */
export function listKits(directory: string): Array<string> {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

/**
 * `wibble`, never `../../etc` and never `--dry-run`.
 *
 * A kit is one directory directly inside the kits directory, so a name that
 * could climb out of it is not a name — and neither is the next flag along,
 * which is what `--kit --dry-run` would otherwise hand us.
 */
export function isKitName(name: string): boolean {
  return name !== '.' && name !== '..' && /^[\w.][\w.-]*$/.test(name)
}

/**
 * `--kit`, read straight out of argv before anything else happens.
 *
 * The subcommand list *is* the registry and a kit contributes generators, so
 * the kit has to be known before there is a citty command to parse it with.
 * Both `--kit wibble` and `--kit=wibble`, anywhere in the arguments. A value
 * that is really the next flag along is caught by `isKitName`, which refuses
 * it by name rather than this quietly returning nothing. (ADR 0007)
 */
export function kitFromArgv(argv: Array<string>): string | null {
  for (const [index, arg] of argv.entries()) {
    if (arg.startsWith('--kit=')) return arg.slice('--kit='.length) || null
    if (arg === '--kit') return argv[index + 1] ?? null
  }

  return null
}

/**
 * Whether this invocation is `scaffold kit …`.
 *
 * Kit management is about the user's own kits, not about the project, so it has
 * to keep working when the project's config or templates are broken — which is
 * exactly the situation you need `kit ls` in. The first argument that is not a
 * flag is the subcommand. (ADR 0007)
 */
export function isKitInvocation(argv: Array<string>): boolean {
  return argv.find((arg) => !arg.startsWith('-')) === KIT_COMMAND
}

/**
 * The absolute path of a named kit.
 *
 * A kit that is not there stops the run and lists the ones that are. Naming a
 * kit is asking for it, and a run that quietly scaffolded the built-in output
 * instead would look exactly like success. (ADR 0007)
 */
export function resolveKit(name: string, directory: string): string {
  if (!isKitName(name)) {
    throw new Error(
      `"${name}" is not a kit name. A kit is one directory directly inside ${directory}.`,
    )
  }

  const path = join(directory, name)
  if (existsSync(path)) return path

  const available = listKits(directory)
  throw new Error(
    available.length > 0
      ? `There is no "${name}" kit. Available: ${available.join(', ')}.`
      : `There is no "${name}" kit, and ${directory} holds none. ` +
          `Create one with \`scaffold kit new ${name}\`.`,
  )
}

/**
 * Resolve `@magicspon/create-cli` from where the *tool* is installed, for
 * handing to jiti as an alias.
 *
 * jiti resolves a file's imports from that file's own directory, and neither a
 * kit nor a project that installed the tool globally has us in its
 * `node_modules`. Without this a kit template cannot import `defineTemplate` —
 * so it can never declare a `fileName`, so it can only override a built-in
 * generator and never declare one — and a global install cannot read a config
 * file that imports `defineConfig` at all. (ADR 0007)
 */
export function selfAlias(): Record<string, string> {
  const jiti = createJiti(import.meta.url)

  // Self-reference through our own `exports` is what works once published.
  // Running from source before a build has no `dist` to reference, so fall
  // back to the entry itself: the same module at an earlier stage.
  for (const specifier of [PACKAGE_NAME, '../define-config.ts']) {
    const [, resolved] = attempt(() => jiti.esmResolve(specifier))
    if (resolved) return { [PACKAGE_NAME]: resolved }
  }

  // Survivable: a template importing nothing still runs, and one that does now
  // fails by name rather than silently rendering something else.
  return {}
}

/**
 * The two files that make a kit an editable package rather than a loose
 * directory.
 *
 * They are what let an editor typecheck the kit after one install. They are not
 * needed to *run* it — `selfAlias` covers that — which is why the new-kit
 * message asks for the install rather than the command performing it.
 * (ADR 0007)
 */
function seedFiles(name: string): Record<string, string> {
  return {
    'package.json': `${JSON.stringify(
      {
        name: `scaffold-kit-${name}`,
        private: true,
        type: 'module',
        devDependencies: { [PACKAGE_NAME]: '*' },
      },
      null,
      2,
    )}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
      },
      null,
      2,
    )}\n`,
  }
}

/**
 * Where our own `src/templates` is, from wherever this module is running.
 *
 * Two candidates for the two shapes the package has: `src/tool/kits.ts` beside
 * `src/templates` in development, and `dist/index.mjs` with this module bundled
 * into it once published — which is why `src/templates` is in the package's
 * `files` and not only `dist`. The same two-candidate shape as `selfAlias`, for
 * the same reason. (ADR 0004)
 *
 * `from` is a parameter so both shapes are testable from one of them.
 */
export function templateSourceDirectory(
  from: string = dirname(fileURLToPath(import.meta.url)),
): string {
  for (const candidate of ['../templates', '../src/templates']) {
    const path = resolve(from, candidate)
    if (existsSync(path)) return path
  }

  throw new Error(
    `The built-in templates are missing from ${from}. Reinstall ${PACKAGE_NAME}.`,
  )
}

/** `'A typed React component'` — descriptions carry no quotes today, but may. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * A built-in template's own source, turned into a kit template file.
 *
 * The body is the real source rather than a paraphrase of it, so a seeded kit
 * starts from what the tool would actually have emitted and there is no second
 * copy of any template to drift. Only two things change: the type import points
 * at the package instead of at a path inside it, and a `defineTemplate` default
 * export carries the generator's config — spelled out in full, so the file
 * declares its generator in a project that never enabled the preset it came
 * from, as readily as it overrides one that did. (ADR 0006, ADR 0007)
 */
export function kitTemplateFile(generator: Generator, source: string): string {
  const render = /export function (\w+)/.exec(source)?.[1]
  if (!render) {
    throw new Error(
      `The built-in template for "${generator.id}" exports no render function.`,
    )
  }

  const meta = [
    `    description: ${quote(generator.description)},`,
    `    directory: ${quote(generator.directory)},`,
    // Serialised rather than restated: it is a one-line arrow over the casings,
    // and writing it out again here is the drift this whole function avoids.
    `    fileName: ${generator.fileName.toString()},`,
    ...(generator.target ? [`    target: ${quote(generator.target)},`] : []),
  ]

  return [
    `// Copied from the built-in \`${generator.id}\` generator. Edit it freely.`,
    '// The filename is the generator id: rename this file to declare a',
    '// generator of your own, and change `fileName` below to suit.',
    '',
    source.replace(
      "import type { TemplateContext } from '../tool/generators.ts'",
      `import { defineTemplate } from '${PACKAGE_NAME}'\n` +
        `import type { TemplateContext } from '${PACKAGE_NAME}'`,
    ),
    'export default defineTemplate(',
    '  {',
    ...meta,
    '  },',
    `  ${render},`,
    ')',
    '',
  ].join('\n')
}

/** A kit as `scaffold kit new` just wrote it. */
export interface CreatedKit {
  /** Absolute path of the kit directory. */
  path: string
  /** The template files seeded into it, in registry order. */
  templates: Array<string>
}

/**
 * Create a kit, seeded with a copy of every built-in template it asked for.
 *
 * Explicit rather than created on first run: a typo would otherwise become an
 * empty kit that scaffolds nothing and reports success, and a tool that writes
 * to `$HOME` unasked is a tool people stop trusting. (ADR 0007)
 *
 * The core arrives by default and a preset only when named, because a kit
 * applies to every project that adopts it — seeding `story.ts` unasked would
 * give a project with no Storybook a `story` generator, which is exactly what
 * shipping the presets switched off exists to prevent. (ADR 0003)
 */
export function createKit(
  name: string,
  directory: string,
  presets: Array<string> = [],
): CreatedKit {
  if (!isKitName(name)) {
    throw new Error(
      `"${name}" is not a kit name. Use letters, numbers, \`.\`, \`-\` and \`_\`.`,
    )
  }

  const path = join(directory, name)
  if (existsSync(path)) {
    throw new Error(`The "${name}" kit already exists at ${path}.`)
  }

  // Both resolved before anything is written, so an unknown preset name leaves
  // no half-seeded kit behind for the retry to refuse as already existing.
  const generators = builtInGenerators(presets)
  const templates = templateSourceDirectory()

  const files: Record<string, string> = { ...seedFiles(name) }
  const seeded: Array<string> = []
  for (const generator of generators) {
    // A built-in's source is `src/templates/<id>.ts` by convention rather than
    // by a field on `Generator` — the convention `kits.test.ts` pins. A read
    // that fails names the file it wanted, which is the whole refusal.
    const source = join(templates, `${generator.id}.ts`)
    const file = `${generator.id}.ts`
    files[file] = kitTemplateFile(generator, readFileSync(source, 'utf8'))
    seeded.push(file)
  }

  mkdirSync(path, { recursive: true })
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(path, file), contents)
  }

  return { path, templates: seeded }
}
