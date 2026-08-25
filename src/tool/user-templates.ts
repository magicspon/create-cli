/**
 * Templates a project keeps in a directory of its own, matched to generators by
 * filename.
 *
 * A file named after an existing generator overrides it: bare, it replaces that
 * generator's render and nothing else (ADR 0005); with a config object, it
 * replaces whatever else it names too. A file naming no existing generator
 * *declares* one, so a project adds a generator by adding a file rather than by
 * also registering it in `generators`. (ADR 0006)
 *
 * The matching key is the **generator id**, and the filename is the only place
 * an id is written — `component`, `hook-test`, and equally a generator the
 * project invented.
 *
 * Everything here except `loadTemplates` is pure, which is what keeps the
 * filename rules and the override rules testable without a filesystem.
 */

import { existsSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { attemptAsync } from 'es-toolkit'
import { createJiti } from 'jiti'

import type { DeclaredTemplate, Generator, Template } from './generators.ts'

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

/** `defineTemplate(config, render)`'s return value, as it arrives back here. */
function isDeclaration(value: unknown): value is DeclaredTemplate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DeclaredTemplate).render === 'function'
  )
}

/**
 * The declaration a loaded template module offers, as the default export or as
 * a named `render`.
 *
 * Both are accepted because a template moved out of a config file's `generators`
 * array arrives already named `render`, and renaming it to a default export
 * would be busywork. A bare function is the render-only form, normalised here
 * so nothing downstream has to know which of the two shapes was written.
 */
export function templateFrom(module: unknown, file: string): DeclaredTemplate {
  // jiti hands back a module namespace, but a transpiled CommonJS template can
  // still arrive as the function itself.
  const candidate =
    typeof module === 'function'
      ? module
      : ((module as Record<string, unknown> | null)?.default ??
        (module as Record<string, unknown> | null)?.render)

  if (typeof candidate === 'function') return { render: candidate as Template }
  if (isDeclaration(candidate)) return candidate

  throw new Error(
    `${file} exports no template. Export it as the default export — a render ` +
      'function, or `defineTemplate(config, render)` — or as `render`.',
  )
}

/**
 * Only what a template file actually declared.
 *
 * Spreading `TemplateMeta` wholesale would overwrite the built-in's description
 * with `undefined` for every field the file left out, which is the opposite of
 * inheriting it. Listed by hand because `TemplateMeta` is a public type and a
 * field added to it should not start applying here silently.
 */
function declaredMeta(template: DeclaredTemplate): Partial<Generator> {
  const meta: Partial<Generator> = {}

  if (template.description !== undefined)
    meta.description = template.description
  if (template.directory !== undefined) meta.directory = template.directory
  if (template.fileName !== undefined) meta.fileName = template.fileName
  if (template.target !== undefined) meta.target = template.target

  return meta
}

/**
 * The generator a template file declares on its own, for a filename naming no
 * existing generator.
 *
 * `fileName` is the one field with no honest default, so a file that omits it
 * is refused — which is also what catches `componant.ts`. That typo used to be
 * caught by there being no `componant` generator; now there is one, and the
 * missing `fileName` is what stops it. (ADR 0006)
 */
function declareGenerator(
  id: string,
  template: DeclaredTemplate,
  available: Array<string>,
): Generator {
  if (!template.fileName) {
    throw new Error(
      `The template for "${id}" declares no fileName, and there is no "${id}" ` +
        `generator to inherit one from. Available: ${available.join(', ')}. ` +
        'Rename the file, give it a fileName, or prefix it with `_` if it is ' +
        'not meant to be a template.',
    )
  }

  return {
    id,
    description: template.description ?? `A ${id}`,
    // The filename names the generator, so it is also the best guess at where
    // that generator writes: `routes.ts` -> `src/routes`.
    directory: template.directory ?? id,
    fileName: template.fileName,
    target: template.target,
    render: template.render,
  }
}

/**
 * Fold each template into the generator list: over the generator of the same
 * id, or as a new one.
 *
 * A file that overrides keeps its position, so composed runs execute in the
 * order the built-ins declare; a file that declares appends.
 */
export function applyTemplates(
  generators: Array<Generator>,
  templates: Record<string, DeclaredTemplate>,
): Array<Generator> {
  const byId = new Map(generators.map((generator) => [generator.id, generator]))
  const available = [...byId.keys()]

  for (const [id, template] of Object.entries(templates)) {
    const existing = byId.get(id)

    byId.set(
      id,
      existing
        ? { ...existing, ...declaredMeta(template), render: template.render }
        : declareGenerator(id, template, available),
    )
  }

  // Checked after the whole list is composed, because one template may target
  // a generator another template declared.
  for (const [id, template] of Object.entries(templates)) {
    if (!template.target || byId.has(template.target)) continue
    throw new Error(
      `The template for "${id}" targets "${template.target}", which is not a ` +
        `generator. Available: ${[...byId.keys()].join(', ')}.`,
    )
  }

  return [...byId.values()]
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
): Promise<Record<string, DeclaredTemplate>> {
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
