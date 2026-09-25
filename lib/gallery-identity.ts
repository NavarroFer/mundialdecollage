// Likes are keyed by the voter's email (artwork_likes), which now always comes
// from their Google session — normalized so capitalization and stray spaces
// never count as a second person.
export function normalizeLikeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null
}
