/**
 * Templates a project keeps in a directory of its own, matched to generators by
 * filename.
 *
 * `generators` already lets a project replace a built-in wholesale, but a
 * project that only wants its own house style for `component` had to restate
 * that generator's id, description, directory and `fileName` in order to change
 * the one function it cared about. A template directory says the same thing by
 * convention: `templates/component.ts` replaces `component`'s render and
 * nothing else. (ADR 0005)
 *
 * The matching key is the **generator id**, not our own template filenames —
 * `component`, `hook-test`, and equally a generator the project defined itself.
 *
 * Everything here except `loadTemplates` is pure, which is what keeps the
 * filename rules and the override rules testable without a filesystem.
 */

import { existsSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { attemptAsync } from 'es-toolkit'
import { createJiti } from 'jiti'

import type { Generator, Template } from './generators.ts'

/**
 * Extensions a template file may use.
 *
 * jiti resolves all of them, so this list is about what we are willing to read
 * as a template rather than about what Node can load.
 */
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.mjs', '.jsx'])

/**
 * The generator id a filename claims, or `null` for a file that is not a
 * template at all.
 *
 * A leading `_` is the escape hatch: it is how a template directory holds
 * shared helpers, since anything else unrecognised is an error rather than
 * noise.
 */
export function templateIdOf(fileName: string): string | null {
  // Dot-prefixed files belong to the editor and the OS, not to the project.
  if (fileName.startsWith('.') || fileName.startsWith('_')) return null
  // A declaration file describes a template; it is never one.
  if (/\.d\.[cm]?ts$/.test(fileName)) return null

  const extension = extname(fileName)
  if (!EXTENSIONS.has(extension)) return null

  return fileName.slice(0, -extension.length) || null
}

/**
 * The template files among a directory's entries, keyed by the generator id
 * each one claims.
 *
 * Two files claiming one id throws rather than picking a winner: which of
 * `component.ts` and `component.tsx` applied would otherwise depend on
 * readdir order, and a generator silently rendering from the wrong file is
 * worse than a refusal.
 */
export function templateFilesIn(entries: Array<string>): Map<string, string> {
  const files = new Map<string, string>()

  // Sorted so the pair named in the error reads the same way on every platform.
  for (const entry of [...entries].sort()) {
    const id = templateIdOf(entry)
    if (!id) continue

    const clash = files.get(id)
    if (clash) {
      throw new Error(
        `${clash} and ${entry} are both templates for "${id}". Keep one of them.`,
      )
    }

    files.set(id, entry)
  }

  return files
}

/**
 * The render function a loaded template module offers, as the default export or
 * as a named `render`.
 *
 * Both are accepted because a template moved out of a config file's `generators`
 * array arrives already named `render`, and renaming it to a default export
 * would be busywork.
 */
export function templateFrom(module: unknown, file: string): Template {
  // jiti hands back a module namespace, but a transpiled CommonJS template can
  // still arrive as the function itself.
  const candidate =
    typeof module === 'function'
      ? module
      : ((module as Record<string, unknown> | null)?.default ??
        (module as Record<string, unknown> | null)?.render)

  if (typeof candidate !== 'function') {
    throw new Error(
      `${file} exports no template function. Export it as the default export, ` +
        'or as `render`.',
    )
  }

  return candidate as Template
}

/**
 * Swap in each template over the generator of the same id.
 *
 * Only `render` is replaced. A project that also wants a different filename or
 * directory is describing a different generator, and says so in `generators`.
 *
 * A template matching no generator throws — the same reasoning as an unknown
 * preset name. Skipping it silently would read as the override not working,
 * which is the one failure a scaffolder cannot afford: the file lands, it is
 * just the wrong file.
 */
export function applyTemplates(
  generators: Array<Generator>,
  templates: Record<string, Template>,
): Array<Generator> {
  const ids = new Set(generators.map((generator) => generator.id))

  const orphan = Object.keys(templates).find((id) => !ids.has(id))
  if (orphan) {
    throw new Error(
      `There is no "${orphan}" generator for the template of that name. ` +
        `Available: ${[...ids].join(', ')}. ` +
        'Prefix the file with `_` if it is not meant to be a template.',
    )
  }

  return generators.map((generator) => {
    const render = templates[generator.id]
    return render ? { ...generator, render } : generator
  })
}

/**
 * Read every template in `directory`, keyed by the generator id it overrides.
 *
 * Loaded through jiti — the same loader c12 already uses for the config file —
 * so a template in its own file is a typechecked TypeScript function exactly
 * like one written inline. (ADR 0003, ADR 0005)
 *
 * A configured directory that does not exist throws rather than resolving to no
 * templates: it can only be a typo or a directory that has not been created
 * yet, and both are better said out loud than answered with built-in output.
 */
export async function loadTemplates(
  directory: string,
  root: string,
): Promise<Record<string, Template>> {
  const absolute = resolve(root, directory)
  if (!existsSync(absolute)) {
    throw new Error(
      `The templates directory "${directory}" does not exist under ${root}.`,
    )
  }

  // Files only: a subdirectory is how a template directory groups its helpers.
  const entries = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)

  const files = [...templateFilesIn(entries)]
  if (files.length === 0) return {}

  // Built here rather than at module scope so a project without a template
  // directory never pays for the loader.
  const jiti = createJiti(import.meta.url)

  const loaded = await Promise.all(
    files.map(async ([id, file]) => {
      const shown = join(directory, file)

      // A template is user code, so a throw on import has to name the file
      // rather than surfacing as an unhandled rejection from inside jiti.
      const [error, module] = await attemptAsync<unknown, Error>(() =>
        jiti.import(join(absolute, file)),
      )
      if (error) {
        throw new Error(`${shown} could not be loaded: ${error.message}`)
      }

      return [id, templateFrom(module, shown)] as const
    }),
  )

  return Object.fromEntries(loaded)
}
