'use client'

import type { Artwork } from '@/data/artworks'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences } from '../preferences/store'
import { ThemePicker } from './ThemePicker'

export function VisitPreferences({ artworks, onResume }: { artworks: Artwork[]; onResume?: (id: string) => void }) {
  const { theme, sensitivity, visited, lastArtwork, update } = useGalleryPreferences()
  const t = useI18n().m.gallery.preferences
  const last = artworks.find((artwork) => artwork.id === lastArtwork)
  return <div className="mt-3 space-y-3 text-sm">
    <ThemePicker theme={theme} onChange={(theme) => update({ theme })} inline />
    <label className="flex flex-wrap items-center justify-between gap-2">
      {t.sensitivity}
      <select className="rounded border border-current bg-transparent p-2" value={sensitivity} onChange={(event) => update({ sensitivity: Number(event.target.value) })}>
        <option value={0.5}>{t.slow}</option><option value={1}>{t.normal}</option><option value={1.5}>{t.fast}</option>
      </select>
    </label>
    <p>{t.visited}: {artworks.filter((artwork) => visited.includes(artwork.id)).length}/{artworks.length}</p>
    {last && onResume && <button type="button" className="min-h-11 underline" onClick={() => onResume(last.id)}>{t.resume}: {last.title}</button>}
    {visited.length > 0 && <button type="button" className="min-h-11 text-xs underline" onClick={() => update({ visited: [], lastArtwork: null })}>{t.reset}</button>}
    <p className="text-xs opacity-70">{t.local}</p>
  </div>
}
