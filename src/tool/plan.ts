/**
 * Resolve a request into the complete set of files it would write, and say
 * whether writing them is permitted — without touching the disk.
 *
 * Composition means several generators contribute to one run, and refusal means
 * a conflict must abort all of them, so the run has to be resolved in full
 * before anything is written. `--dry-run` is this function stopping one step
 * early rather than a parallel code path that can drift from the real one.
 * (ADR 0001)
 *
 * I/O arrives as injected inputs — an `exists` predicate and an already-resolved
 * config — which is what makes the whole matrix of casing, placement,
 * composition and refusal testable as pure functions.
 */

import { posix } from 'node:path'
import { isInside } from './config.ts'
import { casingsOf } from './generators.ts'

import type {
  Generator,
  GeneratorId,
  NameCasings,
  Registry,
} from './generators.ts'
import type { ScaffoldConfig } from './config.ts'

/** What a user asked for, from either the flags or the wizard. */
export interface ScaffoldRequest {
  generator: GeneratorId
  /** Free-form; every casing the templates need is derived from it. */
  name: string
  /** Directory override, relative to the package root. */
  directory?: string
  /** Extra generators composed into the same run, in the order given. */
  with?: Array<GeneratorId>
  /** Permit overwriting a file that already exists. */
  force?: boolean
}

/** One file a run would write, fully rendered but not yet on disk. */
export interface PlannedFile {
  generator: GeneratorId
  /** Relative to the package root. */
  path: string
  contents: string
}

/** Why a run was refused. Stable enough for a caller to branch on. */
export type RejectionKind =
  | 'invalid-name'
  | 'invalid-directory'
  | 'unknown-generator'
  | 'protected'
  | 'conflict'
  | 'missing-target'

/** Everything a run would write, or the single reason it may not. */
export type Plan =
  | { ok: true; files: Array<PlannedFile> }
  | {
      ok: false
      kind: RejectionKind
      reason: string
      /** The path that caused the refusal, where there is one. */
      path?: string
    }

/** The outside world, injected — which is what keeps `plan` a pure function. */
export interface PlanIO {
  config: ScaffoldConfig
  /** Whether `path`, relative to the project root, already exists on disk. */
  exists: (path: string) => boolean
}

function reject(
  kind: RejectionKind,
  reason: string,
  path?: string,
): Extract<Plan, { ok: false }> {
  return { ok: false, kind, reason, path }
}

/**
 * A directory in the one form the rest of this file may compare against.
 *
 * `isInside` is a string comparison, so `./src/components/ui` and
 * `src/components/../components/ui` would both walk straight past the registry
 * guard while `commit()`'s `join(root, path)` resolved them right back into it.
 * Normalising here is what makes that guard mean what it says. `null` for
 * anything absolute or escaping the package root — `commit()` would write
 * outside the project.
 *
 * `posix.normalize` is a pure string function; nothing here touches the disk.
 */
function normaliseDirectory(directory: string): string | null {
  const trimmed = directory.trim()
  if (!trimmed) return null
  // A Windows drive letter or UNC path is absolute too, and `posix` will not
  // say so.
  if (posix.isAbsolute(trimmed) || /^([A-Za-z]:|\\\\)/.test(trimmed))
    return null

  const normalised = posix.normalize(trimmed).replace(/\/+$/, '')
  if (normalised === '..' || normalised.startsWith('../')) return null

  return normalised
}

interface ResolvedTarget {
  generator: Generator
  directory: string
  path: string
}

/** Where each generator in the run would write, before any validation. */
function resolveAll(
  request: ScaffoldRequest,
  casings: NameCasings,
  config: ScaffoldConfig,
): Array<ResolvedTarget> | Extract<Plan, { ok: false }> {
  const ids = [request.generator, ...(request.with ?? [])]
  const resolved: Array<ResolvedTarget> = []

  for (const id of ids) {
    const generator = config.registry.find(id)
    if (!generator) {
      return reject('unknown-generator', `There is no "${id}" generator.`)
    }

    // A generator naming a directory key nothing configures writes to the
    // project root, which is a legitimate answer for a flat project.
    const requested =
      request.directory ?? config.directories[generator.directory] ?? '.'
    const directory = normaliseDirectory(requested)
    if (directory === null) {
      return reject(
        'invalid-directory',
        `"${requested}" is not a directory inside this project. ` +
          'Pass a path relative to the package root.',
        requested,
      )
    }

    resolved.push({
      generator,
      directory,
      path: `${directory}/${generator.fileName(casings)}`,
    })
  }

  return resolved
}

type Refusal = Extract<Plan, { ok: false }> | null

/**
 * Safety before convenience: a protected directory is refused even under
 * `--force`, because the thing being guarded against is a typo, and a typo is
 * exactly as likely on a forced run. (CONTEXT.md: invariant)
 */
function refuseProtected(
  resolved: Array<ResolvedTarget>,
  protect: Array<string>,
): Refusal {
  for (const { directory } of resolved) {
    const owner = protect.find((parent) => isInside(directory, parent))
    if (!owner) continue

    return reject(
      'protected',
      `${owner} is protected by scaffold.config.ts — another tool owns it and ` +
        'will overwrite it. Write to a directory this project owns instead.',
      directory,
    )
  }

  return null
}

/** Two generators in one run writing the same file. `--force` does not help. */
function refuseCollision(resolved: Array<ResolvedTarget>): Refusal {
  const seen = new Set<string>()
  for (const { path } of resolved) {
    if (seen.has(path)) {
      return reject(
        'conflict',
        `Two generators in this run both write ${path}.`,
        path,
      )
    }
    seen.add(path)
  }
  return null
}

function refuseOverwrite(resolved: Array<ResolvedTarget>, io: PlanIO): Refusal {
  const offender = resolved.find(({ path }) => io.exists(path))
  if (!offender) return null

  return reject(
    'conflict',
    `${offender.path} already exists. Pass --force to overwrite it.`,
    offender.path,
  )
}

/**
 * A target may be a file on disk *or* a file this same run is about to write.
 * That single rule is what makes `component --with story` succeed while `story`
 * alone against a missing component fails.
 */
function refuseMissingTarget(
  resolved: Array<ResolvedTarget>,
  casings: NameCasings,
  registry: Registry,
  io: PlanIO,
): Refusal {
  const planned = new Set(resolved.map(({ path }) => path))

  for (const { generator, directory } of resolved) {
    const target = generator.target
      ? registry.find(generator.target)
      : undefined
    if (!target) continue

    const path = `${directory}/${target.fileName(casings)}`
    if (planned.has(path) || io.exists(path)) continue

    return reject(
      'missing-target',
      `${generator.id} needs ${path}, which does not exist. ` +
        `Generate it in the same run with --with ${target.id}.`,
      path,
    )
  }

  return null
}

/**
 * How a generated file refers to the target beside it.
 *
 * Extensionless, which is what bundler resolution expects. Emitting
 * `./card.tsx` is a type error in any project that has not switched on
 * `allowImportingTsExtensions` — most of them — so the extension would make
 * every scaffolded story fail to typecheck on arrival.
 */
function targetImportFor(
  generator: Generator,
  casings: NameCasings,
  registry: Registry,
): string {
  const fileName = generator.target
    ? registry.find(generator.target)?.fileName(casings)
    : undefined
  if (!fileName) return ''

  // Only the final extension goes: `use-mouse.browser.test` keeps its infix.
  return `./${fileName.replace(/\.[^./]+$/, '')}`
}

/**
 * Resolve a request into a full plan, or refuse it.
 *
 * Never writes and never reads the disk directly; `io.exists` is the only
 * window onto it. The refusal, when there is one, names the offending path.
 */
export function plan(request: ScaffoldRequest, io: PlanIO): Plan {
  const { config } = io

  const casings = casingsOf(request.name)
  if (!casings) {
    return reject(
      'invalid-name',
      `"${request.name}" has no letters or digits to build a name from.`,
    )
  }

  const resolved = resolveAll(request, casings, config)
  if (!Array.isArray(resolved)) return resolved

  // Order is the order a user would want to hear about it: the hazard first,
  // then what this run collides with, then what it depends on.
  const refusal =
    refuseProtected(resolved, config.protect) ??
    refuseCollision(resolved) ??
    (request.force ? null : refuseOverwrite(resolved, io)) ??
    refuseMissingTarget(resolved, casings, config.registry, io)
  if (refusal) return refusal

  const files = resolved.map(({ generator, directory, path }) => ({
    generator: generator.id,
    path,
    contents: generator.render({
      ...casings,
      directory,
      path,
      targetImport: targetImportFor(generator, casings, config.registry),
      imports: config.imports,
    }),
  }))

  return { ok: true, files }
}
