/**
 * The target prompt, shared by the wizard and by the flags.
 *
 * It lives on its own because both front ends ask it. `scaffold story` with no
 * name and `scaffold` with no arguments have to reach the same question, or the
 * guided route and the one an agent half-takes drift apart — the same reason
 * `run.ts` exists.
 *
 * `targets.ts` stays free of clack so it can be tested as data; this file is
 * the only part that talks to a terminal.
 */

import { autocomplete, cancel, confirm } from '@clack/prompts'
import { isInside } from './config.ts'
import {
  createTargetSearch,
  listSourceFiles,
  listTargets,
  noTargetsMessage,
} from './targets.ts'
import { releaseStdin, unwrap } from './prompts.ts'

import type { Generator } from './generators.ts'
import type { ScaffoldConfig } from './config.ts'

/** What picking a target answers: the two questions it makes redundant. */
export interface PickedTarget {
  name: string
  directory: string
  /** The picked file already has this generator's output beside it. */
  force: boolean
}

/**
 * Pick the file `generator` will be written against.
 *
 * `null` means the run is over and `process.exitCode` has been set — either
 * there was nothing to pick, or an overwrite was declined. Both are ordinary
 * outcomes rather than errors, so neither throws.
 *
 * `scope` narrows the list to one directory and everything under it, which is
 * what `--dir` means here: it cannot move a target that already exists, so the
 * only honest reading is that it filters.
 */
export async function pickTarget(
  generator: Generator,
  config: ScaffoldConfig,
  scope?: string,
): Promise<PickedTarget | null> {
  const all = listTargets(
    generator,
    listSourceFiles(config),
    config.registry,
    config.protect,
  )
  const targets = scope
    ? all.filter((target) => isInside(target.directory, scope))
    : all

  // Checked before anything is drawn: an empty list is a question with no right
  // answer, and the useful thing to say is which generator would fill it.
  if (targets.length === 0) {
    releaseStdin()
    cancel(
      scope
        ? `Nothing under ${scope} that a ${generator.id} can be written for.`
        : noTargetsMessage(generator, config.registry),
    )
    process.exitCode = 1
    return null
  }

  const byPath = new Map(targets.map((target) => [target.path, target]))
  const search = createTargetSearch(targets, generator)

  const path = unwrap(
    await autocomplete<string>({
      message: `Which ${generator.target}?`,
      maxItems: 8,
      options() {
        return search(this.userInput)
      },
      // The getter has already matched and ranked; clack's own filter is a
      // substring test that would drop the fuzzy hits before they are drawn.
      filter: () => true,
    }),
  )

  const picked = byPath.get(path)
  if (!picked) {
    releaseStdin()
    cancel(`${path} is not a file this run can be written against.`)
    process.exitCode = 1
    return null
  }

  if (!picked.hasOutput) {
    return { name: picked.name, directory: picked.directory, force: false }
  }

  // The wizard has no `--force`, so without this prompt retrofitting onto a
  // component that already has a story — ADR 0001's deciding case — would be
  // unreachable from the guided route.
  const overwrite = unwrap(
    await confirm({
      message: `${picked.output} already exists. Overwrite it?`,
      initialValue: false,
    }),
  )

  if (!overwrite) {
    releaseStdin()
    cancel('Nothing written.')
    // Declining is an answer, not a failure — the same exit `unwrap` gives a
    // cancelled prompt.
    process.exitCode = 0
    return null
  }

  return { name: picked.name, directory: picked.directory, force: true }
}
