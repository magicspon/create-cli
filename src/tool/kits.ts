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

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { attempt } from 'es-toolkit'
import { createJiti } from 'jiti'

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
 * What `scaffold kit new` writes.
 *
 * The `package.json` and `tsconfig.json` are what let an editor typecheck the
 * kit after one install. They are not needed to *run* it — `selfAlias` covers
 * that — which is why the new-kit message asks for the install rather than the
 * command performing it. (ADR 0007)
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
    // One working template rather than an empty directory, because an empty kit
    // refuses the run and a brand new kit should not.
    'component.ts': [
      "import { defineTemplate } from '@magicspon/create-cli'",
      '',
      '// The filename is the generator id: this file overrides `component`.',
      '// Rename it to declare a generator of your own — a new id needs a',
      '// `fileName`, since there is nothing to inherit one from.',
      'export default defineTemplate(',
      '  {',
      `    description: 'A component in the ${name} house style',`,
      "    directory: 'components',",
      '    fileName: ({ kebabName }) => `${kebabName}.tsx`,',
      '  },',
      '  ({ pascalName }) =>',
      '    `export function ${pascalName}() {\\n  return null\\n}\\n`,',
      ')',
      '',
    ].join('\n'),
  }
}

/**
 * Create a kit and return its path.
 *
 * Explicit rather than created on first run: a typo would otherwise become an
 * empty kit that scaffolds nothing and reports success, and a tool that writes
 * to `$HOME` unasked is a tool people stop trusting. (ADR 0007)
 */
export function createKit(name: string, directory: string): string {
  if (!isKitName(name)) {
    throw new Error(
      `"${name}" is not a kit name. Use letters, numbers, \`.\`, \`-\` and \`_\`.`,
    )
  }

  const path = join(directory, name)
  if (existsSync(path)) {
    throw new Error(`The "${name}" kit already exists at ${path}.`)
  }

  mkdirSync(path, { recursive: true })
  for (const [file, contents] of Object.entries(seedFiles(name))) {
    writeFileSync(join(path, file), contents)
  }

  return path
}
