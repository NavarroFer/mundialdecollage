import { create } from 'zustand'

// The obras discovered are already in the visit preferences (visited); the
// passport adds which exhibition days were walked and how many photos taken.
export type PassportRecord = { days: string[]; photos: number }

const KEY_PREFIX = 'mdc-gallery-passport-v1:'
// A year of daily exhibitions.
const MAX_DAYS = 366
const empty: PassportRecord = { days: [], photos: 0 }

export function parsePassport(raw: string | null): PassportRecord {
  try {
    const value = JSON.parse(raw ?? '{}') ?? {}
    const days = Array.isArray(value.days) ? value.days.filter((day: unknown) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) : []
    return {
      days: [...new Set<string>(days)].sort().slice(-MAX_DAYS),
      photos: Number.isSafeInteger(value.photos) && value.photos > 0 ? value.photos : 0,
    }
  } catch {
    return { ...empty }
  }
}

type State = PassportRecord & {
  open: boolean
  setOpen: (open: boolean) => void
  /** Each account has its own passport, even sharing a browser. */
  storageKey: string | null
  hydrate: (userId: string) => void
  recordDay: (day: string) => void
  recordPhoto: () => void
}

export const usePassportStore = create<State>((set, get) => {
  const save = (patch: Partial<PassportRecord>) => {
    set(patch)
    const { storageKey, days, photos } = get()
    if (!storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify({ days, photos })) } catch {}
  }
  return {
    ...empty,
    open: false,
    setOpen: (open) => set({ open }),
    storageKey: null,
    hydrate: (userId) => {
      const storageKey = `${KEY_PREFIX}${userId}`
      let raw: string | null = null
      try { raw = localStorage.getItem(storageKey) } catch {}
      set({ storageKey, ...parsePassport(raw) })
    },
    recordDay: (day) => {
      const { days } = get()
      if (!days.includes(day)) save({ days: [...days, day].sort().slice(-MAX_DAYS) })
    },
    recordPhoto: () => save({ photos: get().photos + 1 }),
  }
})
