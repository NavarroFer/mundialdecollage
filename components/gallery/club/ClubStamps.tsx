'use client'

import { useEffect, useRef, useState } from 'react'
import { Stamp } from 'lucide-react'
import type { Artwork } from '@/data/artworks'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences } from '../preferences/store'
import { usePresenceStore } from '../presence/store'
import styles from '../gallery-theme.module.css'

// Attention reaches the database every 30 s (AttentionRecorder), so the
// postal stamp is asked again a few times after the last obra is opened.
const POSTAL_RETRY_MS = 35_000
const POSTAL_TRIES = 4

type Kind = 'postal' | 'vernissage'

// A Club gallery's two stamps for the visitor's album: the artist's postal
// stamp, once every hung obra was opened, and «Estuve en el Vernissage»,
// for being in the room while its member is there. The database decides
// (supabase/migrations/20261029230000_club_stamps.sql); this asks at the
// right moment and says so when one is earned.
export function ClubStamps({ slug, artistName, artworks, userId, isOwner }: { slug: string; artistName: string; artworks: Artwork[]; userId: string | null; isOwner: boolean }) {
  const { m } = useI18n()
  const [earned, setEarned] = useState<Kind | null>(null)
  const asked = useRef<Set<Kind>>(new Set())
  const visited = useGalleryPreferences((state) => state.visited)
  const hostHere = usePresenceStore((state) => state.hostHere)
  const allOpened = artworks.length > 0 && artworks.every((artwork) => visited.includes(artwork.id))

  useEffect(() => {
    if (!earned) return
    const timer = window.setTimeout(() => setEarned(null), 6000)
    return () => window.clearTimeout(timer)
  }, [earned])

  useEffect(() => {
    if (!userId || isOwner || !allOpened || asked.current.has('postal')) return
    asked.current.add('postal')
    let tries = 0
    let timer: number | undefined
    const ask = async () => {
      tries += 1
      const { data, error } = await createClient().rpc('collect_club_stamp', { p_slug: slug, p_kind: 'postal' })
      if (!error && data === 'collected') setEarned('postal')
      else if (!error && data === 'missing' && tries < POSTAL_TRIES) timer = window.setTimeout(() => void ask(), POSTAL_RETRY_MS)
    }
    timer = window.setTimeout(() => void ask(), 5000)
    return () => window.clearTimeout(timer)
  }, [userId, isOwner, allOpened, slug])

  useEffect(() => {
    if (!userId || isOwner || !hostHere || asked.current.has('vernissage')) return
    asked.current.add('vernissage')
    void createClient().rpc('collect_club_stamp', { p_slug: slug, p_kind: 'vernissage' }).then(({ data, error }) => {
      if (!error && data === 'collected') setEarned('vernissage')
    })
  }, [userId, isOwner, hostHere, slug])

  if (!earned) return null
  return (
    <div role="status" className="animate-in fade-in pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4 duration-300">
      <div className={`${styles.hudPanel} flex items-center gap-3 px-5 py-3 text-sm font-semibold`}>
        <Stamp className="size-5 shrink-0" aria-hidden="true" />
        {fmt(earned === 'postal' ? m.gallery.clubStamps.postal : m.gallery.clubStamps.vernissage, { name: artistName })}
      </div>
    </div>
  )
}
