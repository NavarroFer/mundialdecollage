// What an artist typed into /onboarding, kept in sessionStorage as they type.
// Instagram's browser can reload the page when its file picker closes (the
// app runs short of memory while the gallery is open), which used to wipe the
// form. A picked file can't be kept, only the text around it. Per account and
// per mode, so a second obra never starts from the first one's title.
export type OnboardingDraft = {
  name: string
  country: string
  instagram: string
  website: string
  artworks: { title: string; technique: string }[]
}

const KEY = 'mdc-onboarding-draft'

const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 500) : '')

export function parseDraft(raw: string | null, scope: string): OnboardingDraft | null {
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as { scope?: unknown; draft?: Partial<OnboardingDraft> }
    if (stored.scope !== scope || !stored.draft) return null
    const { draft } = stored
    const artworks = Array.isArray(draft.artworks)
      ? draft.artworks.slice(0, 10).map((artwork) => ({ title: text(artwork?.title), technique: text(artwork?.technique) }))
      : []
    return {
      name: text(draft.name),
      country: text(draft.country),
      instagram: text(draft.instagram),
      website: text(draft.website),
      artworks: artworks.length ? artworks : [{ title: '', technique: '' }],
    }
  } catch {
    return null
  }
}

export function draftFromForm(form: HTMLFormElement): OnboardingDraft {
  const data = new FormData(form)
  const titles = data.getAll('artwork_title')
  const techniques = data.getAll('technique')
  return {
    name: text(data.get('name')),
    country: text(data.get('country_code')),
    instagram: text(data.get('instagram')),
    website: text(data.get('website')),
    artworks: titles.map((title, index) => ({ title: text(title), technique: text(techniques[index]) })),
  }
}

// Only worth bringing back when the artist actually wrote something.
export function hasContent(draft: OnboardingDraft, defaults: Pick<OnboardingDraft, 'name' | 'country' | 'instagram' | 'website'>) {
  return draft.artworks.some((artwork) => artwork.title.trim() || artwork.technique)
    || draft.artworks.length > 1
    || (['name', 'country', 'instagram', 'website'] as const).some((field) => draft[field].trim() !== defaults[field].trim())
}

// Storage can be missing or throw (private mode, blocked site data): the
// form must work the same without it.
export function readDraft(scope: string): OnboardingDraft | null {
  try {
    return parseDraft(sessionStorage.getItem(KEY), scope)
  } catch {
    return null
  }
}

export function writeDraft(scope: string, draft: OnboardingDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ scope, draft }))
  } catch {}
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
}
