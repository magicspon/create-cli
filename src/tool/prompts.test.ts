/**
 * The clack helpers, which are all about the process rather than the prompt.
 *
 * `@clack/prompts` is mocked because a cancelled prompt is signalled with a
 * symbol the package keeps to itself: there is no way to hand `unwrap` a real
 * one without drawing a prompt and pressing ctrl-c. What matters here is the
 * three things cancelling does — say so, release stdin, exit cleanly — and the
 * mock leaves all three to the code under test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MockInstance } from 'vitest'
import { cancel } from '@clack/prompts'
import { isInteractive, releaseStdin, unwrap } from './prompts.ts'
import { restoreTTY, setTTY } from './testing.ts'

const CANCELLED = Symbol('clack:cancel')

vi.mock('@clack/prompts', () => ({
  cancel: vi.fn(),
  isCancel: (value: unknown) => value === CANCELLED,
}))

let pause: MockInstance<typeof process.stdin.pause>
let unref: MockInstance<typeof process.stdin.unref>

beforeEach(() => {
  pause = vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  unref = vi.spyOn(process.stdin, 'unref').mockReturnValue(process.stdin)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(cancel).mockClear()
  restoreTTY()
})

describe('releaseStdin', () => {
  it('pauses and unrefs, so the event loop can drain', () => {
    releaseStdin()

    expect(pause).toHaveBeenCalled()
    expect(unref).toHaveBeenCalled()
  })
})

describe('unwrap', () => {
  it('returns an ordinary answer untouched', () => {
    expect(unwrap('Card')).toBe('Card')
    expect(unwrap(false)).toBe(false)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('says nothing was written and exits cleanly when cancelled', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })

    expect(() => unwrap(CANCELLED)).toThrow('process.exit')

    expect(cancel).toHaveBeenCalledWith('Nothing written.')
    expect(unref).toHaveBeenCalled()
    // Cancelling is an answer, not a failure.
    expect(exit).toHaveBeenCalledWith(0)
  })
})

describe('isInteractive', () => {
  it('needs both ends of the pipe to be a terminal', () => {
    setTTY(true, true)
    expect(isInteractive()).toBe(true)

    setTTY(false, true)
    expect(isInteractive()).toBe(false)

    setTTY(true, false)
    expect(isInteractive()).toBe(false)
  })
})
