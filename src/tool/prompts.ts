/**
 * The bits of clack that every CLI in here needs.
 *
 * `releaseStdin` is not optional: clack leaves its reader attached after the
 * last prompt resolves and that handle keeps the event loop alive, so the CLI
 * prints its last line and then hangs — in a pipe and in a real terminal alike.
 * Unreffing rather than calling `process.exit` lets buffered stdout flush.
 */

import { cancel, isCancel } from '@clack/prompts'

/** Detach clack's stdin reader so the event loop can drain. */
export function releaseStdin(): void {
  process.stdin.pause()
  process.stdin.unref()
}

/** Every prompt can be cancelled; bail the same way from all of them. */
export function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Nothing written.')
    releaseStdin()
    process.exit(0)
  }
  return value
}

/**
 * Whether prompting is possible at all.
 *
 * An agent piping into this tool must get an error rather than a prompt that
 * never returns — a hanging invocation is the one failure mode a non-interactive
 * caller cannot recover from.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}
