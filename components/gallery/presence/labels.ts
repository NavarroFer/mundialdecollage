// `count` always includes the viewer once they're inside, so 0 can only show
// up for a moment before their own presence syncs — treat it as "just you".
export function insideLabel(count: number): string {
  return count <= 1 ? 'Solo vos en la galería' : `${count} personas en la galería`
}

// Before entering, the viewer isn't counted yet: every person here is someone
// else. Nothing is shown for an empty room rather than advertising it.
export function waitingLabel(count: number): string | null {
  if (count <= 0) return null
  return count === 1
    ? 'Ahora hay 1 persona recorriendo la exposición'
    : `Ahora hay ${count} personas recorriendo la exposición`
}
