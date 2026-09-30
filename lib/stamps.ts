export const STAMP_KEYS = ['first', 'gallery', 'world'] as const

export type StampKey = (typeof STAMP_KEYS)[number]

export function isStampKey(value: string): value is StampKey {
  return STAMP_KEYS.includes(value as StampKey)
}

export const STAMP_UNLOCKED_EVENT = 'mundial:stamp-unlocked'

export function announceStampUnlocked(stamp: StampKey) {
  window.dispatchEvent(new CustomEvent<StampKey>(STAMP_UNLOCKED_EVENT, { detail: stamp }))
}
