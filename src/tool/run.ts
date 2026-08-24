/**
 * Plan, report, write — the path both the flags and the wizard take.
 *
 * Keeping this here rather than in either front end is what makes
 * `scaffold component Card` and answering four prompts the same operation, so
 * an agent and a person cannot end up exercising different code.
 *
 * The config arrives already loaded. Loading it here would mean reading and
 * executing the project's `scaffold.config.ts` twice per run — once to build
 * the subcommands from its registry, once to plan — and a config file with any
 * side effect at all would then behave differently from how it reads.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { commit, format } from './commit.ts'
import { plan } from './plan.ts'

import type { Plan, PlannedFile, ScaffoldRequest } from './plan.ts'
import type { ScaffoldConfig } from './config.ts'

/** A request plus the one option that only matters once I/O is involved. */
export interface ScaffoldRun extends ScaffoldRequest {
  /** Resolve and print the plan, write nothing. */
  dryRun?: boolean
}

/** Resolve a request against the real filesystem. */
export function resolveRun(
  request: ScaffoldRequest,
  config: ScaffoldConfig,
): Plan {
  return plan(request, {
    config,
    exists: (path) => existsSync(join(config.root, path)),
  })
}

const RULE = '─'.repeat(60)

/** `1 file`, `2 files`. */
export function countFiles(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`
}

/** Every path and its contents, as `--dry-run` prints them. */
function preview(files: Array<PlannedFile>): number {
  const bodies = files.map(
    (file) => `${RULE}\n${file.path}\n${RULE}\n${file.contents.trimEnd()}`,
  )

  console.log(
    [
      `Would write ${countFiles(files.length)}:`,
      ...files.map((file) => `  ${file.path}`),
      '',
      ...bodies,
    ].join('\n'),
  )

  return 0
}

function write(files: Array<PlannedFile>, config: ScaffoldConfig): number {
  const written = commit({ ok: true, files }, config.root)
  const problem = format(written, config.root, config.format)

  for (const file of files) console.log(`+ ${file.path}`)
  if (problem) {
    console.error(`! Written, but ${problem} — format them by hand.`)
  }

  return 0
}

/**
 * Run a request end to end. Returns the process exit code — `1` on any refusal,
 * so a caller can detect failure without parsing text.
 */
export function execute(run: ScaffoldRun, config: ScaffoldConfig): number {
  const result = resolveRun(run, config)

  if (!result.ok) {
    console.error(`✖ ${result.reason}`)
    return 1
  }

  return run.dryRun ? preview(result.files) : write(result.files, config)
}
