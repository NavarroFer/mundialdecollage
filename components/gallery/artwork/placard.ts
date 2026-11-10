/**
 * Breaks a title into the lines of a wall label: words are kept whole, at most
 * `lines` lines, the last one cut with an ellipsis when the title is longer.
 * A single word longer than a line stays on a line of its own.
 */
export function wrapTitle(title: string, perLine = 21, lines = 3): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= perLine || !current) current = next
    else {
      out.push(current)
      current = word
    }
  }
  if (current) out.push(current)
  if (out.length <= lines) return out
  const kept = out.slice(0, lines)
  kept[lines - 1] = `${kept[lines - 1].slice(0, Math.max(1, perLine - 1)).trimEnd()}…`
  return kept
}
