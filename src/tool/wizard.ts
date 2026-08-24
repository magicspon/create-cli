/**
 * The argumentless path.
 *
 * `scaffold` with no arguments lands here. It asks the same questions the flags
 * express and then hands the answers to the same `execute`, so the guided route
 * cannot behave differently from the one an agent takes.
 *
 * How many questions there are depends on the generator. One with a target is
 * pointed at a file rather than named, and picking that file answers where it
 * goes as well — so `story` asks three where `component` asks four.
 */

import {
  autocomplete,
  cancel,
  confirm,
  intro,
  multiselect,
  note,
  outro,
  select,
  text,
} from '@clack/prompts'
import { join, relative } from 'node:path'
import { createDirectorySearch, listDirectories } from './directories.ts'
import { sourceRoot } from './config.ts'
import { pickTarget } from './pick.ts'
import { isInteractive, releaseStdin, unwrap } from './prompts.ts'
import { countFiles, execute, resolveRun } from './run.ts'

import type { Generator, GeneratorId } from './generators.ts'
import type { ScaffoldConfig } from './config.ts'
import type { ScaffoldRequest } from './plan.ts'

/** The directories worth offering, relative to the package root. */
function sourceDirectories(config: ScaffoldConfig): Array<string> {
  return listDirectories(join(config.root, sourceRoot(config))).map((path) =>
    relative(config.root, path),
  )
}

/** Name and directory, for a generator that is creating something new. */
async function askNameAndDirectory(
  generator: Generator,
  config: ScaffoldConfig,
): Promise<{ name: string; directory: string; force: boolean }> {
  const name = unwrap(
    await text({
      message: `Name of the ${generator.id}`,
      placeholder: 'DataTable',
      validate: (value) => (value?.trim() ? undefined : 'Required'),
    }),
  )

  // Search rather than recall: the existing tree is offered, fuzzy-matched as
  // you type, and a name that matches nothing becomes a new directory inside
  // whichever row is highlighted.
  const fallback = config.directories[generator.directory] ?? '.'
  const search = createDirectorySearch(fallback, sourceDirectories(config))
  const directory = unwrap(
    await autocomplete<string>({
      message: 'Directory',
      placeholder: fallback,
      maxItems: 8,
      options() {
        return search(this.userInput, this.focusedValue)
      },
      // The getter has already matched and ranked; clack's own filter is a
      // substring test that would drop the fuzzy hits before they are drawn.
      filter: () => true,
    }),
  )

  return { name, directory, force: false }
}

/** The questions the flags express, asked one at a time. */
async function askRequest(
  config: ScaffoldConfig,
): Promise<ScaffoldRequest | null> {
  const id = unwrap(
    await select<GeneratorId>({
      message: 'What do you want to create?',
      options: config.registry.all.map((generator) => ({
        value: generator.id,
        label: generator.id,
        hint: generator.description,
      })),
    }),
  )

  const generator = config.registry.find(id)
  if (!generator) {
    cancel(`There is no "${id}" generator.`)
    releaseStdin()
    process.exitCode = 1
    return null
  }

  // A generator with a target is not being named, it is being pointed at
  // something. Picking the file answers the name and the directory at once,
  // and answers them with a path that is known to exist.
  const chosen = generator.target
    ? await pickTarget(generator, config)
    : await askNameAndDirectory(generator, config)
  if (!chosen) return null

  // The target itself is never worth composing after a pick: it is the file
  // that was just chosen, so generating it too is a guaranteed collision.
  const others = config.registry.all.filter(
    (candidate) => candidate.id !== id && candidate.id !== generator.target,
  )
  const composed = unwrap(
    await multiselect<GeneratorId>({
      message: 'Also generate, in the same run?',
      required: false,
      options: others.map((candidate) => ({
        value: candidate.id,
        label: candidate.id,
        hint: candidate.description,
      })),
    }),
  )

  // Accepting the default has to mean exactly what omitting `--dir` means, or
  // the two front ends diverge: with an explicit directory every composed
  // generator co-locates, and without one each falls back to its own alias — so
  // a composed hook would land beside the component here and in `src/hooks`
  // from the flags.
  const fallback = config.directories[generator.directory] ?? '.'

  return {
    generator: id,
    name: chosen.name,
    directory: chosen.directory === fallback ? undefined : chosen.directory,
    with: composed,
    force: chosen.force,
  }
}

/** Show the plan, ask, and only then write. */
async function confirmAndWrite(
  request: ScaffoldRequest,
  config: ScaffoldConfig,
): Promise<void> {
  const result = resolveRun(request, config)

  if (!result.ok) {
    releaseStdin()
    cancel(result.reason)
    process.exitCode = 1
    return
  }

  note(
    result.files.map((file) => file.path).join('\n'),
    `Will write ${countFiles(result.files.length)}`,
  )

  const proceed = unwrap(await confirm({ message: 'Write them?' }))

  // Every prompt is done by this point; nothing else needs stdin.
  releaseStdin()

  if (!proceed) {
    cancel('Nothing written.')
    return
  }

  process.exitCode = execute(request, config)
  outro('Done.')
}

/** Ask, preview, confirm, write. Requires a terminal; refuses without one. */
export async function runWizard(config: ScaffoldConfig): Promise<void> {
  // A wizard piped into is a wizard that answers itself out of an empty stdin
  // and reports success having written nothing. Refuse instead, so the caller
  // that cannot see prompts finds out by exit code. (See ../prompts.ts)
  if (!isInteractive()) {
    console.error(
      '✖ `scaffold` with no arguments opens a wizard, which needs a terminal. ' +
        'Run `scaffold --help` for the non-interactive form.',
    )
    process.exitCode = 1
    return
  }

  intro(' scaffold ')

  const request = await askRequest(config)
  if (request) await confirmAndWrite(request, config)
}
