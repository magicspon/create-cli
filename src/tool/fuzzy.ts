/**
 * Fuzzy path matching, shared by every prompt in here that offers a path.
 *
 * Extracted from the directory prompt when the target picker needed the same
 * ranking. The two prompts have opposite rules — one invents paths that do not
 * exist yet, the other refuses anything that does not — but there is only ever
 * one sensible answer to "how well does what I typed match this path", so the
 * scorer lives on its own rather than inside either of them.
 */

/**
 * How well `query` matches `target`, or `-1` when it does not match at all.
 *
 * A subsequence match rather than a substring one, so `slgen` finds
 * `src/lib/gen`. Runs of adjacent characters and matches at a segment boundary
 * score highest, since those are what a person typing an abbreviation means;
 * gaps cost a little, and longer paths break ties towards the shorter one.
 */
export function fuzzyScore(query: string, target: string): number {
  const needle = query.toLowerCase()
  const haystack = target.toLowerCase()

  let score = 0
  let from = 0
  let previous = -1

  for (const char of needle) {
    const at = haystack.indexOf(char, from)
    if (at === -1) return -1

    if (at === previous + 1) score += 8
    if (at === 0 || /[/\-_.]/.test(haystack[at - 1] ?? '')) score += 6
    score -= Math.min(at - from, 4)

    previous = at
    from = at + 1
  }

  return score - haystack.length / 10
}

/** Trailing slashes are how people type paths; they are not part of one. */
export function normalise(path: string): string {
  return path.trim().replace(/\/+$/, '')
}
