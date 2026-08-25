/**
 * Where things live and which generators exist — read from the project's own
 * `scaffold.config.ts` rather than from another tool's config file.
 *
 * An earlier version read shadcn's `components.json`, which made the whole
 * scaffolder unusable outside a shadcn project. Now the config file is the only
 * source: it declares directories, enables presets, and supplies user
 * generators. Everything has a working default, so a project with no config
 * file at all still scaffolds. (ADR 0003)
 */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'
import { loadConfig as loadC12 } from 'c12'
import { builtInGenerators, createRegistry } from './generators.ts'
import { applyTemplates, loadTemplates } from './user-templates.ts'

import type { DeclaredTemplate, Generator, Registry } from './generators.ts'

/** The name c12 searches for — `scaffold.config.ts`, `.scaffoldrc`, and friends. */
const CONFIG_NAME = 'scaffold'

/**
 * The template directory a project gets without configuring one.
 *
 * Probed rather than required, so a project adds its first generator by adding
 * a file and nothing else. One path rather than a list of candidates: which of
 * several won would be a rule to learn, and the point is not having to learn
 * one. (ADR 0006)
 */
export const DEFAULT_TEMPLATE_DIRECTORY = 'scaffold/templates'

/**
 * Directories every built-in generator falls back to.
 *
 * Deliberately conventional rather than clever: a project that disagrees says
 * so in its config, and one that does not gets the layout most React projects
 * already have.
 */
export const DEFAULT_DIRECTORIES: Record<string, string> = {
  components: 'src/components',
  hooks: 'src/hooks',
  lib: 'src/lib',
}

/** What a user writes in `scaffold.config.ts`. Every field is optional. */
export interface ScaffoldUserConfig {
  /**
   * Where each generator writes by default, keyed by the generator's
   * `directory`. Merged over the defaults, so naming one key keeps the rest.
   */
  directories?: Record<string, string>
  /**
   * Import specifiers templates may reference, e.g. `{ utils: '#/lib/utils.ts' }`.
   * Reaches templates as `context.imports`. Only user templates read these —
   * no built-in template depends on one.
   */
  imports?: Record<string, string>
  /** Built-in generator groups to switch on, e.g. `['storybook', 'msw']`. */
  presets?: Array<string>
  /** Generators this project defines itself. Override a built-in by reusing its id. */
  generators?: Array<Generator>
  /**
   * Directory of template files, relative to the project root. A file named
   * after a generator overrides it; a file named after nothing declares a new
   * one. Defaults to `scaffold/templates` when that directory exists.
   * (ADR 0005, ADR 0006)
   */
  templates?: string
  /** Built-in ids to switch off, by id. */
  disable?: Array<string>
  /**
   * Directories that are never a valid write target, even under `--force`.
   * For directories another tool owns and overwrites — `src/components/ui`
   * under shadcn, say.
   */
  protect?: Array<string>
  /**
   * Commands run over the written files, each receiving their paths as
   * arguments. Resolved from the project's `node_modules/.bin` first.
   */
  format?: Array<string>
}

/** The scaffolder's resolved view of one project. */
export interface ScaffoldConfig {
  /** Absolute path of the project root this run resolved against. */
  root: string
  /** Absolute path of the config file, or `null` when running on defaults. */
  configFile: string | null
  /** Each generator's default directory, relative to `root`. */
  directories: Record<string, string>
  /** Import specifiers handed to every template. */
  imports: Record<string, string>
  /** Directories no generator may write into. Relative to `root`. */
  protect: Array<string>
  /** Formatter commands run over written files. */
  format: Array<string>
  /** Every generator this project has, built-ins and user ones alike. */
  registry: Registry
}

/** `src/components/ui` owns itself and everything under it, but not `uikit`. */
export function isInside(directory: string, parent: string): boolean {
  return directory === parent || directory.startsWith(`${parent}/`)
}

/**
 * The directory the pickers search, relative to the project root.
 *
 * The shallowest first segment across the configured directories — `src` for a
 * conventional layout — rather than the project root, which would enumerate
 * `docs/`, `node_modules/` and every other place a component cannot go.
 */
export function sourceRoot(config: ScaffoldConfig): string {
  const segments = Object.values(config.directories)
    .map((directory) => directory.split('/')[0] ?? '')
    .filter(Boolean)

  // Every configured directory sharing one first segment is the common case;
  // anything else has no single root to search, so search the whole project.
  const unique = new Set(segments)
  return unique.size === 1 ? (segments[0] ?? '') : ''
}

/**
 * The nearest ancestor of `from` containing a `package.json`.
 *
 * This is the entirety of workspace support: in a single-package repo it
 * resolves to the root, and in a workspace it resolves to the package the
 * command was invoked from. There is no package picker and no enumeration.
 */
export function findPackageRoot(from: string): string {
  let current = resolve(from)
  const { root } = parse(current)

  while (!existsSync(join(current, 'package.json'))) {
    if (current === root) {
      throw new Error(`No package.json found at or above ${from}`)
    }
    current = dirname(current)
  }

  return current
}

/**
 * Which generators a config asks for: the core, plus each named preset, plus
 * the project's own — minus anything it disabled.
 *
 * A user generator reusing a built-in id replaces it rather than colliding with
 * it, which is how a project keeps `component` in the wizard and in `--with`
 * while emitting its own house style. (ADR 0003)
 */
export function resolveGenerators(user: ScaffoldUserConfig): Array<Generator> {
  const disabled = new Set(user.disable ?? [])

  const enabled = builtInGenerators(user.presets ?? []).filter(
    (generator) => !disabled.has(generator.id),
  )

  // Later entries win, so a user generator sharing an id overrides the
  // built-in in place rather than appending a duplicate.
  const byId = new Map(enabled.map((generator) => [generator.id, generator]))
  for (const generator of user.generators ?? []) {
    if (disabled.has(generator.id)) continue
    byId.set(generator.id, generator)
  }

  return [...byId.values()]
}

/**
 * Fold a loaded config file into the resolved shape the rest of the tool uses.
 *
 * `templates` arrives already read from disk, because this stays synchronous:
 * loading is `loadConfig`'s job, and everything downstream — `plan()` above
 * all — sees an overridden generator as just a generator. (ADR 0005)
 */
export function resolveConfig(
  user: ScaffoldUserConfig,
  root: string,
  configFile: string | null = null,
  templates: Record<string, DeclaredTemplate> = {},
): ScaffoldConfig {
  // Applied last, over the fully composed list, so a template file can
  // override a generator the project defined itself as readily as a built-in.
  const registry = createRegistry(
    applyTemplates(resolveGenerators(user), templates),
  )

  return {
    root,
    configFile,
    directories: resolveDirectories(user, registry),
    imports: { ...user.imports },
    protect: user.protect ?? [],
    format: user.format ?? [],
    registry,
  }
}

/**
 * A path for every directory key the resolved registry actually uses.
 *
 * A generator declared in a template file names a key nothing configures —
 * that is the whole point of not needing a config file — and falling through to
 * the project root would scaffold `src/routes/home.route.ts` into the repo root
 * instead. `src/<key>` is not a new convention: it is what every entry in
 * `DEFAULT_DIRECTORIES` already spells out. (ADR 0006)
 */
function resolveDirectories(
  user: ScaffoldUserConfig,
  registry: Registry,
): Record<string, string> {
  const directories: Record<string, string> = {
    ...DEFAULT_DIRECTORIES,
    ...user.directories,
  }

  for (const { directory } of registry.all) {
    if (directories[directory]) continue
    // A key with a `/` in it was written as a path, not as a key — `src/routes`
    // means `src/routes`, never `src/src/routes`.
    directories[directory] = directory.includes('/')
      ? directory
      : `src/${directory}`
  }

  return directories
}

/**
 * Load the scaffolder's view of the project, walking up from `from`.
 *
 * The package root is found first and the config file is looked for *there*,
 * rather than in the working directory. c12 does not search upwards, so loading
 * from `from` directly would make `scaffold component Card` behave differently
 * in `src/components` than at the root — the tool has to work from a
 * subdirectory.
 *
 * Never throws for a missing config file: the defaults are a working
 * configuration. It throws only when there is no `package.json` anywhere above
 * `from`, which means there is no project to scaffold into.
 */
export async function loadConfig(
  from: string = process.cwd(),
): Promise<ScaffoldConfig> {
  const root = findPackageRoot(from)

  const { config, configFile } = await loadC12<ScaffoldUserConfig>({
    name: CONFIG_NAME,
    cwd: root,
    packageJson: true,
  })

  // c12 reports the *name* it looked for when it found nothing, so a bare
  // `scaffold.config` here means "no config file" rather than a path.
  const found =
    configFile && isAbsolute(configFile) && existsSync(configFile)
      ? configFile
      : null

  // A configured directory that is missing still throws; the conventional one
  // is a lookup, because "no templates" and "no such directory" are the same
  // answer when nobody asked for it. (ADR 0006)
  const directory =
    config.templates ??
    (existsSync(join(root, DEFAULT_TEMPLATE_DIRECTORY))
      ? DEFAULT_TEMPLATE_DIRECTORY
      : null)

  // The only disk read besides the config file itself.
  const templates = directory ? await loadTemplates(directory, root) : {}

  return resolveConfig(config, root, found, templates)
}
