#!/usr/bin/env node
/**
 * The scaffolder CLI.
 *
 * One subcommand per generator, derived from the registry the project's config
 * resolved to — so a generator a project defines itself appears in `--help`,
 * in `--with` and in the wizard exactly like a built-in one, with no second
 * place to register it. (ADR 0003)
 *
 * That is why the config is loaded before the command is defined rather than
 * inside a handler: the subcommand list *is* the registry, so it cannot be
 * built until the config file has been read.
 */

import { text } from '@clack/prompts'
import { defineCommand, runMain } from 'citty'
import { attempt } from 'es-toolkit'
import { findPackageRoot, loadConfig, resolveConfig } from './tool/config.ts'
import {
  KIT_COMMAND,
  createKit,
  isKitInvocation,
  kitFromArgv,
  kitsDirectory,
  listKits,
} from './tool/kits.ts'
import { pickTarget } from './tool/pick.ts'
import { isInteractive, releaseStdin, unwrap } from './tool/prompts.ts'
import { execute } from './tool/run.ts'
import { runWizard } from './tool/wizard.ts'

import type { Generator, Registry } from './tool/generators.ts'
import type { ScaffoldConfig } from './tool/config.ts'

/**
 * `--with story --with test` and `--with story,test` both mean the same run.
 *
 * Returns the reason rather than throwing, so a mistyped generator reads as a
 * refusal like every other one instead of as a stack trace.
 */
function parseWith(
  raw: unknown,
  registry: Registry,
): { ids: Array<string> } | { error: string } {
  const given = Array.isArray(raw) ? (raw as Array<unknown>) : [raw]
  const ids = given
    .filter((value) => typeof value === 'string')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

  const unknown = ids.filter((id) => !registry.has(id))
  if (unknown.length > 0) {
    return {
      error:
        `Unknown generator${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
        `Available: ${registry.all.map((generator) => generator.id).join(', ')}.`,
    }
  }

  return { ids }
}

/**
 * Kit management, which is not a generator and so does not come from the
 * registry. That is exactly why `kit` is a reserved generator id: these
 * subcommands and a `kit` generator would be one name in one namespace.
 * (ADR 0007)
 */
const kitCommand = defineCommand({
  meta: {
    name: KIT_COMMAND,
    description: `Manage kits — shared template directories in ${kitsDirectory()}`,
  },
  subCommands: {
    new: defineCommand({
      meta: { name: 'new', description: 'Create a kit and print its path' },
      args: {
        name: { type: 'positional', required: true, description: 'Kit name' },
      },
      run: ({ args }) => {
        const [error, path] = attempt<string, Error>(() =>
          createKit(String(args.name), kitsDirectory()),
        )

        if (error) {
          console.error(`✖ ${error.message}`)
          process.exitCode = 1
          return
        }

        console.log(`+ ${path}`)
        console.log(`  scaffold component Card --kit ${String(args.name)}`)
        // The alias makes the kit run without this; the install is only what
        // makes an editor typecheck it. (ADR 0007)
        console.log(`  install in ${path} to typecheck its templates`)
      },
    }),
    ls: defineCommand({
      meta: { name: 'ls', description: 'List the kits you have' },
      run: () => {
        const directory = kitsDirectory()
        const kits = listKits(directory)

        if (kits.length === 0) {
          console.log(
            `No kits in ${directory}. Create one with \`scaffold ${KIT_COMMAND} new <name>\`.`,
          )
          return
        }

        // Names alone, one per line, so the output is worth piping.
        console.log(kits.join('\n'))
      },
    }),
  },
})

/** What the positional argument would have said, however it was arrived at. */
interface Chosen {
  name: string
  /** Set only by a pick, which knows where the target already lives. */
  directory?: string
  force?: boolean
}

/**
 * What to build, prompted for when there is a terminal and demanded when there
 * is not. One command therefore serves both callers without a second
 * implementation — and a piped invocation can never deadlock on a prompt.
 *
 * A generator with a target gets the picker rather than a text field, which is
 * the same question the wizard asks. Asking for a name here and offering a list
 * there would make `scaffold story` the worse half of the same tool.
 */
async function resolveChoice(
  given: string | undefined,
  generator: Generator,
  config: ScaffoldConfig,
  dir: string | undefined,
): Promise<Chosen | null> {
  if (given?.trim()) return { name: given }

  if (!isInteractive()) {
    console.error(
      `✖ \`scaffold ${generator.id}\` needs a name. ` +
        `Pass it as the first argument: scaffold ${generator.id} MyThing`,
    )
    process.exitCode = 1
    return null
  }

  if (generator.target) return pickTarget(generator, config, dir)

  const name = unwrap(
    await text({
      message: `Name of the ${generator.id}`,
      validate: (value) => (value?.trim() ? undefined : 'Required'),
    }),
  )
  releaseStdin()
  return { name }
}

function subCommandFor(generator: Generator, config: ScaffoldConfig) {
  const others = config.registry.all
    .filter((candidate) => candidate.id !== generator.id)
    .map((candidate) => candidate.id)
    .join(', ')

  const fallback = config.directories[generator.directory] ?? '.'

  return defineCommand({
    meta: { name: generator.id, description: generator.description },
    args: {
      name: {
        type: 'positional',
        required: false,
        description: 'Name of the thing to create, in any casing',
      },
      dir: {
        type: 'string',
        description: `Target directory (default: ${fallback})`,
      },
      with: {
        type: 'string',
        description: `Also run these generators in the same run: ${others}`,
      },
      'dry-run': {
        type: 'boolean',
        description: 'Print the plan and its contents; write nothing',
      },
      force: {
        type: 'boolean',
        description: 'Overwrite files that already exist',
      },
      // Declared to be ignored. `kitFromArgv` has already read it, but citty
      // treats an *undeclared* flag's value as a positional — so without this,
      // `scaffold component --kit wibble Card` scaffolds a component called
      // `wibble` and reports success. (ADR 0007)
      kit: {
        type: 'string',
        description: `Use templates from this kit in ${kitsDirectory()}`,
      },
    },
    run: async ({ args }) => {
      const composed = parseWith(args.with, config.registry)
      if ('error' in composed) {
        console.error(`✖ ${composed.error}`)
        process.exitCode = 1
        return
      }

      const dir = args.dir || undefined
      const chosen = await resolveChoice(args.name, generator, config, dir)
      // Every path that gives up has already said why and set its own exit
      // code — declining an overwrite wrote nothing, which is not a failure.
      if (chosen === null) return

      process.exitCode = execute(
        {
          generator: generator.id,
          name: chosen.name,
          directory: chosen.directory ?? dir,
          with: composed.ids,
          dryRun: Boolean(args['dry-run']),
          force: Boolean(args.force) || Boolean(chosen.force),
        },
        config,
      )
    },
  })
}

/**
 * A config file that throws — an unknown preset, a syntax error — must read as
 * a refusal rather than an unhandled rejection, since it is the one part of
 * this tool the user wrote themselves.
 */
async function load(argv: Array<string>): Promise<ScaffoldConfig> {
  try {
    return await loadConfig(process.cwd(), kitFromArgv(argv))
  } catch (error: unknown) {
    // `scaffold kit …` manages the user's own kits and has nothing to do with
    // this project, so a broken template here must not take it down with it —
    // that is precisely when you need `kit ls` to still answer. (ADR 0007)
    if (isKitInvocation(argv)) {
      return resolveConfig({}, findPackageRoot(process.cwd()))
    }

    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

const config = await load(process.argv.slice(2))

const main = defineCommand({
  meta: {
    name: 'scaffold',
    // Every generator takes the same five flags, so naming them here means one
    // `--help` shows the whole surface rather than one per generator.
    description:
      "Generate files in your project's house style. " +
      'Every generator takes NAME plus --dir, --with, --dry-run, --force and ' +
      '--kit; run `scaffold <generator> --help` for the detail.',
  },
  subCommands: {
    ...Object.fromEntries(
      config.registry.all.map((generator) => [
        generator.id,
        subCommandFor(generator, config),
      ]),
    ),
    [KIT_COMMAND]: kitCommand,
  },
  // No subcommand means no flags to remember — drop into the wizard.
  run: ({ args }) => (args._.length === 0 ? runWizard(config) : undefined),
})

void runMain(main)
