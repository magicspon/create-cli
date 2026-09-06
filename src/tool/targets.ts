/**
 * The files a targeted generator can be scaffolded *against*, and the ranking
 * that offers one.
 *
 * `story` and `hook-test` write beside a file that already exists, and naming
 * that file from memory is the step most likely to go wrong — a near miss does
 * not write a story for the wrong component, it refuses, which is worse because
 * the file you meant was right there. So the prompt offers the real list.
 *
 * Nothing here reads a file's contents. Which files are offerable is decided by
 * their names alone, so CONTEXT.md's rule that a generator never inspects its
 * target survives untouched. (ADR 0001)
 */

import { readdirSync } from 'node:fs'
import { join, posix, relative } from 'node:path'
import { attempt } from 'es-toolkit'
import { isInside, sourceRoot } from './config.ts'
import { listDirectories } from './directories.ts'
import { casingsOf } from './generators.ts'
import { fuzzyScore, normalise } from './fuzzy.ts'

import type { Generator, Registry } from './generators.ts'
import type { ScaffoldConfig } from './config.ts'

/** One file a targeted generator could be run against. */
export interface TargetFile {
  /** The target itself, relative to the package root. */
  path: string
  /** Directory holding it, relative to the package root. */
  directory: string
  /** The name a request derives from it — `wibble`, `use-mouse`. */
  name: string
  /** What the generator would write beside it, relative to the package root. */
  output: string
  /** Whether that output is already there, so writing it needs `--force`. */
  hasOutput: boolean
}

/**
 * Every file at or under `root`, using the same traversal as the directory
 * prompt — same depth cap, same ignore rules, already under test — rather than
 * a second walker that could disagree with it.
 */
export function listFiles(root: string): Array<string> {
  return listDirectories(root).flatMap((directory) => {
    const [error, entries] = attempt(() =>
      readdirSync(directory, { withFileTypes: true }),
    )
    if (error || !entries) return []

    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => join(directory, entry.name))
  })
}

/** Every file under the source root, relative to the package root. */
export function listSourceFiles(config: ScaffoldConfig): Array<string> {
  return listFiles(join(config.root, sourceRoot(config))).map((path) =>
    relative(config.root, path),
  )
}

/** `wibble.stories.tsx` → `wibble`. Everything before the first dot. */
function stemOf(fileName: string): string {
  // `split` always yields a first element; the `??` is the strict-mode guard.
  /* v8 ignore next */
  return fileName.split('.')[0] ?? ''
}

/**
 * The files `generator` could be run against, given every file in the project.
 *
 * Offerable is decided by a round trip: feed a file's stem back through
 * `casingsOf` and the *target's own* `fileName`, and keep it only if that
 * reproduces the name it started with. One rule replaces a table of globs and
 * exclusions, and it stays right when a new generator is registered —
 * `wibble.stories.tsx` derives `wibble.tsx`, `noop.ts` derives `use-noop.ts`,
 * and `IconButton.tsx` derives `icon-button.tsx`, so none of the three is
 * offered and none of the three would have worked.
 *
 * Files in a protected directory are dropped separately, because that is a fact
 * about where a file sits rather than what it is called: `button.tsx` under a
 * protected `src/components/ui` round-trips perfectly, but the story would be
 * written beside it, and that is refused even under `--force`.
 *
 * Pure: `files` is the only view of the project, which is also how `hasOutput`
 * is answered without a second trip to the disk.
 */
export function listTargets(
  generator: Generator,
  files: Array<string>,
  registry: Registry,
  protect: Array<string> = [],
): Array<TargetFile> {
  const target = generator.target ? registry.find(generator.target) : undefined
  if (!target) return []

  const known = new Set(files)

  return files.flatMap((path) => {
    const fileName = posix.basename(path)
    const name = stemOf(fileName)
    const casings = casingsOf(name)
    if (!casings || target.fileName(casings) !== fileName) return []

    const directory = posix.dirname(path)
    if (protect.some((parent) => isInside(directory, parent))) return []

    const output = `${directory}/${generator.fileName(casings)}`

    return [{ path, directory, name, output, hasOutput: known.has(output) }]
  })
}

/** What the prompt draws for one target. */
interface TargetOption {
  value: string
  label: string
  hint?: string
}

/**
 * A stateful option source for one run of the target prompt.
 *
 * Deliberately not `createDirectorySearch`: that prompt's whole trick is
 * offering a path that does not exist yet, and here a target that does not
 * exist is exactly the thing being prevented. All the two share is the scorer.
 */
export function createTargetSearch(
  targets: Array<TargetFile>,
  generator: Generator,
) {
  const toOption = (target: TargetFile): TargetOption => ({
    value: target.path,
    label: target.path,
    hint: target.hasOutput ? `already has a ${generator.id}` : undefined,
  })

  return (input: string): Array<TargetOption> => {
    const query = normalise(input)
    if (!query) return targets.map(toOption)

    return targets
      .map((target) => ({ target, score: fuzzyScore(query, target.path) }))
      .filter((match) => match.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ target }) => toOption(target))
  }
}

/**
 * Why there is nothing to pick, and what to run instead.
 *
 * The generator that would create a target is already in the registry, so the
 * advice names itself rather than being written out per generator.
 */
export function noTargetsMessage(
  generator: Generator,
  registry: Registry,
): string {
  const target = generator.target ? registry.find(generator.target) : undefined
  if (!target) return `${generator.id} has nothing to be written against.`

  return (
    `There are no ${target.id}s to write a ${generator.id} for.\n` +
    `  Create one first:  scaffold ${target.id} <name>\n` +
    `  Or both at once:   scaffold ${target.id} <name> --with ${generator.id}`
  )
}
