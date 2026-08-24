/**
 * The two lines that touch the disk, plus the handoff to the formatter.
 *
 * `commit` deliberately re-checks nothing. Every refusal lives in `plan()`, so
 * a rejected plan reaching here is a programming error rather than a user one —
 * hence the throw. The scaffolder writes files and stops; formatting is the
 * project's formatter's job and correctness is its typechecker's.
 * (CONTEXT.md: boundaries)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

import type { Plan } from './plan.ts'

/**
 * Write every file in an accepted plan, creating parent directories.
 *
 * Returns the absolute path of each file written, in plan order.
 */
export function commit(plan: Plan, root: string): Array<string> {
  if (!plan.ok) {
    throw new Error(
      `Refusing to commit a rejected plan (${plan.kind}): ${plan.reason}`,
    )
  }

  return plan.files.map((file) => {
    const target = join(root, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.contents)
    return target
  })
}

/**
 * Run the project's own formatter commands over the written files.
 *
 * Which commands those are comes from `scaffold.config.ts`, because a published
 * tool cannot know what a project formats with — hard-coding `oxfmt` made the
 * step fail in every project that uses Prettier. No commands configured means
 * no formatting, which is why every template is emitted already formatted.
 * (ADR 0003)
 *
 * Each command is looked up in the project's `node_modules/.bin` first, so
 * `prettier --write` finds the project's version rather than whatever is on
 * `PATH`. The written paths are appended as arguments.
 *
 * Best-effort on purpose: a scaffold that landed but could not be formatted is
 * still a scaffold that landed, and failing the run here would leave files on
 * disk while reporting failure — the one outcome the all-or-nothing rule exists
 * to prevent. Returns the reason it gave up, or `null` on success.
 */
export function format(
  paths: Array<string>,
  root: string,
  commands: Array<string>,
): string | null {
  if (paths.length === 0 || commands.length === 0) return null

  for (const command of commands) {
    const [binary, ...args] = command.split(/\s+/).filter(Boolean)
    if (!binary) continue

    const local = join(root, 'node_modules/.bin', binary)
    const executable = existsSync(local) ? local : binary

    const result = spawnSync(executable, [...args, ...paths], {
      cwd: root,
      stdio: 'ignore',
    })
    if (result.error) return `could not run ${binary}`
    // A non-zero exit is the formatter saying it did not do its job. Silence
    // here would leave a file the project's own checks reject, which is the one
    // thing the formatting step exists to prevent.
    if (result.status !== 0) return `${binary} exited ${result.status ?? '?'}`
  }

  return null
}
