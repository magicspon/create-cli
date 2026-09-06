/**
 * Helpers the CLI's own tests share.
 *
 * Every test here runs against a real temporary project, and the cases only
 * differ in which files exist and what the prompts answer — so the tree
 * building, the TTY swapping and the two casts that get at a clack prompt's
 * internals live here rather than once per test file.
 *
 * Test-only: nothing under `src/tool/` that ships imports it.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveConfig } from './config.ts'

import type { ScaffoldConfig } from './config.ts'

/**
 * A project at `root` containing exactly these files, each empty, with the
 * storybook preset registered unless `user` says otherwise.
 */
export function createProject(
  root: string,
  files: Array<string> = [],
  user = {},
): ScaffoldConfig {
  for (const file of files) {
    mkdirSync(join(root, dirname(file)), { recursive: true })
    writeFileSync(join(root, file), '')
  }

  return resolveConfig({ presets: ['storybook'], ...user }, root)
}

/**
 * Call a clack prompt's option getter the way clack calls it: as a method on
 * the live prompt, so `this.userInput` is whatever has been typed so far.
 */
export function optionsOf<State>(
  prompt: { options: unknown },
  state: State,
): Array<{ value: unknown; label: string; hint?: string }> {
  const get = prompt.options as (
    this: State,
  ) => Array<{ value: unknown; label: string; hint?: string }>
  return get.call(state)
}

/** A prompt's validator, which clack types as "a function or a schema". */
export function validatorOf(prompt: {
  validate?: unknown
}): (value: string) => string | undefined {
  return prompt.validate as (value: string) => string | undefined
}

/**
 * `isTTY` is a plain property, so it is swapped rather than spied on. The
 * values are `boolean | undefined` because that is what the runner may have
 * left there — a pipe has no `isTTY` at all.
 */
export function setTTY(
  stdin: boolean | undefined,
  stdout: boolean | undefined = stdin,
): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: stdin,
    configurable: true,
  })
  Object.defineProperty(process.stdout, 'isTTY', {
    value: stdout,
    configurable: true,
  })
}

// Read once, at import: what the runner handed over, before any test has
// swapped it.
const originalTTY = {
  stdin: process.stdin.isTTY,
  stdout: process.stdout.isTTY,
}

/** Put `isTTY` back the way the test runner had it. */
export function restoreTTY(): void {
  setTTY(originalTTY.stdin, originalTTY.stdout)
}
