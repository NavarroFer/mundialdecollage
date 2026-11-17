'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, CircleCheck, LockKeyhole, Share2, X } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { useI18n } from '@/lib/i18n/client'
import { STAMP_LOOKS, STAMP_TONES } from '@/components/stamp-catalog'
import { ARTIST_STAMPS, isStampKey, openStampShare, STAMP_KEYS, STAMP_UNLOCKED_EVENT, VISITOR_STAMPS, LEGEND_STAMP, type ClubStamp, type StampKey, type StampUnlocked } from '@/lib/stamps'
import { fmt } from '@/lib/i18n/format'
import { countryCodeToName } from '@/lib/participants'
import { formatDayMonth } from '@/lib/i18n/format'
import type { CollectedArtworkStamp } from '@/components/stamp-album'

const TUTORIAL_KEY = 'mundial-stamps-tutorial-seen'
const TOTAL = STAMP_KEYS.length

export function StampAlbumClient({ signedIn, unlockedStamps: initialUnlockedStamps, artworkStamps }: { signedIn: boolean; unlockedStamps: string[]; artworkStamps: CollectedArtworkStamp[] }) {
  const { locale, m } = useI18n()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [unlockedStamps, setUnlockedStamps] = useState<StampKey[]>(() => initialUnlockedStamps.filter(isStampKey))
  const [collectedArtworkStamps, setCollectedArtworkStamps] = useState(artworkStamps)
  // Read with the album's sync below, not in the page render.
  const [clubStamps, setClubStamps] = useState<ClubStamp[]>([])

  const syncStamps = useCallback(async () => {
    const response = await fetch('/api/stamps', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json() as { signedIn: boolean; unlockedStamps: string[]; artworkStamps: CollectedArtworkStamp[]; clubStamps?: ClubStamp[] }
    if (data.signedIn) {
      setUnlockedStamps(data.unlockedStamps.filter(isStampKey))
      setCollectedArtworkStamps(data.artworkStamps)
      setClubStamps(data.clubStamps ?? [])
    }
  }, [])

  // A route can be restored from the browser/Next cache when returning to the
  // homepage. Re-read the album then, so a stamp earned elsewhere is never
  // hidden behind an older server render.
  useEffect(() => {
    if (!signedIn) return
    // Let hydration finish first. This forces a read even when Next restores
    // the home route from its client cache instead of mounting it again.
    const initialSync = window.setTimeout(() => void syncStamps(), 0)
    const onReturn = () => void syncStamps()
    window.addEventListener('focus', onReturn)
    window.addEventListener('pageshow', onReturn)
    window.addEventListener('popstate', onReturn)
    return () => {
      window.clearTimeout(initialSync)
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('pageshow', onReturn)
      window.removeEventListener('popstate', onReturn)
    }
  }, [signedIn, syncStamps])

  useEffect(() => {
    const onUnlocked = (event: Event) => {
      const { stamp, awarded } = (event as CustomEvent<StampUnlocked>).detail
      setUnlockedStamps((current) => current.includes(stamp) ? current : [...current, stamp])
      // Show the album only for the stamp just earned, not on every later
      // country tap or gallery visit that re-confirms it.
      if (awarded) setAlbumOpen(true)
    }
    window.addEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
    return () => window.removeEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
  }, [])

  // The bell's notices and the toast lead to /#album.
  useEffect(() => {
    const openFromHash = () => { if (window.location.hash === '#album') { setTutorialOpen(false); setAlbumOpen(true) } }
    const first = window.setTimeout(openFromHash, 0)
    window.addEventListener('hashchange', openFromHash)
    return () => { window.clearTimeout(first); window.removeEventListener('hashchange', openFromHash) }
  }, [])

  useEffect(() => {
    if (signedIn || window.localStorage.getItem(TUTORIAL_KEY)) return
    window.localStorage.setItem(TUTORIAL_KEY, '1')
    const frame = window.requestAnimationFrame(() => setTutorialOpen(true))
    return () => window.cancelAnimationFrame(frame)
  }, [signedIn])

  return (
    <>
      <button type="button" onClick={() => { setTutorialOpen(false); setAlbumOpen(true) }} className="fixed right-3 bottom-[calc(1.25rem+var(--tab-bar-space,0px))] z-40 flex items-center gap-2 rounded-full border-2 border-ink bg-collage-yellow px-4 py-3 text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue sm:right-6" aria-label={m.stamps.title}>
        <BookOpen className="size-5" aria-hidden="true" /> <span className="hidden sm:inline">{m.stamps.eyebrow}</span><span className="rounded-full border border-ink/25 bg-paper px-1.5 py-0.5 text-xs tabular-nums">{unlockedStamps.length}/{TOTAL}</span>
      </button>

      {(albumOpen || tutorialOpen) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5" role="dialog" aria-modal="true" aria-labelledby="stamp-album-title">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_var(--color-collage-yellow)] sm:p-8">
            <button type="button" onClick={() => { setTutorialOpen(false); setAlbumOpen(false) }} className="absolute top-3 right-3 rounded-full p-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-collage-blue" aria-label={m.stamps.close}><X className="size-5" aria-hidden="true" /></button>
            {tutorialOpen ? <>
              <p className="text-sm font-bold tracking-[0.2em] text-collage-red uppercase">{m.stamps.eyebrow}</p>
              <h3 id="stamp-album-title" className="font-display mt-2 text-3xl uppercase">{m.stamps.howItWorks}</h3>
              <ol className="mt-5 space-y-3 text-sm text-muted-foreground"><li><strong className="text-ink">1.</strong> {m.stamps.stepRegister}</li><li><strong className="text-ink">2.</strong> {m.stamps.stepExplore}</li><li><strong className="text-ink">3.</strong> {m.stamps.stepCollect}</li></ol>
              <Link href="/onboarding" className="mt-7 inline-flex min-h-11 items-center justify-center bg-collage-red px-5 py-3 font-bold text-paper transition hover:bg-collage-red/90">{m.stamps.registerCta}</Link>
            </> : <>
              <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">{m.stamps.eyebrow}</p>
              <h3 id="stamp-album-title" className="font-display mt-2 text-3xl uppercase">{m.stamps.title}</h3>
              <p className="mt-2 max-w-xl text-muted-foreground">{fmt(m.stamps.body, { total: TOTAL })}</p>
              <p className="mt-3 text-sm font-bold tabular-nums" role="status">{fmt(m.stamps.image.progress, { count: unlockedStamps.length, total: TOTAL })}</p>
              {([
                [m.stamps.visitorGroup, VISITOR_STAMPS],
                [m.stamps.artistGroup, ARTIST_STAMPS],
                [null, [LEGEND_STAMP]],
              ] as const).map(([heading, keys]) => (
                <div key={heading ?? LEGEND_STAMP} className="mt-7">
                  {heading && <h4 className="font-display mb-3 text-xl uppercase">{heading} <span className="text-sm font-bold tabular-nums opacity-70">{keys.filter((key) => unlockedStamps.includes(key)).length}/{keys.length}</span></h4>}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {keys.map((key, index) => <StampCard key={key} stampKey={key} index={index} unlocked={unlockedStamps.includes(key)} signedIn={signedIn} count={unlockedStamps.length} onSignedOut={() => setTutorialOpen(true)} />)}
                  </div>
                </div>
              ))}
              <section className="mt-9 border-t-2 border-ink pt-6">
                <div className="flex items-baseline justify-between gap-4"><h4 className="font-display text-2xl uppercase">Obras que guardaste</h4><span className="text-sm font-bold">{collectedArtworkStamps.length}</span></div>
                {collectedArtworkStamps.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {collectedArtworkStamps.map((stamp) => <Link key={stamp.slug} href={`/obras/${stamp.slug}`} className="group overflow-hidden border-2 border-dashed border-ink bg-collage-yellow/20 p-2 shadow-[3px_3px_0_var(--color-ink)]">
                    {/* A real obra is the stamp artwork until the illustrated stamp set arrives. */}
                    <Image src={stamp.image} alt={stamp.title} width={240} height={240} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                    <p className="mt-2 truncate font-display text-base uppercase">{stamp.title}</p><p className="truncate text-xs font-semibold text-muted-foreground">{stamp.artist}</p>
                  </Link>)}
                </div> : <p className="mt-3 text-sm text-muted-foreground">Entrá a la galería y guardá las obras que más te gusten.</p>}
              </section>
              {clubStamps.length > 0 && <section className="mt-9 border-t-2 border-ink pt-6">
                <div className="flex items-baseline justify-between gap-4"><h4 className="font-display text-2xl uppercase">{m.stamps.club.title}</h4><span className="text-sm font-bold">{clubStamps.length}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {clubStamps.map((stamp) => <Link key={`${stamp.slug}:${stamp.kind}`} href={`/club/${stamp.slug}`} className={`group relative block overflow-hidden border-2 border-dashed border-ink p-3 text-center shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 ${stamp.kind === 'postal' ? 'bg-collage-blue/10' : 'bg-collage-red/10'}`}>
                    <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">{stamp.kind === 'postal' ? m.stamps.club.postal : m.stamps.club.vernissage}</p>
                    <p className="mt-2 font-display text-lg leading-tight uppercase">{stamp.artist}</p>
                    {stamp.countryCode && <p className="mt-1 text-xs font-semibold text-muted-foreground">{countryCodeToName(stamp.countryCode, locale)}</p>}
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatDayMonth(locale, stamp.collectedAt)}</p>
                    <span className="absolute -right-5 -bottom-5 size-14 rounded-full border-2 border-current opacity-25" />
                  </Link>)}
                </div>
              </section>}
            </>}
          </div>
        </div>
      )}
    </>
  )
}

function StampCard({ stampKey, index, unlocked, signedIn, count, onSignedOut }: { stampKey: StampKey; index: number; unlocked: boolean; signedIn: boolean; count: number; onSignedOut: () => void }) {
  const { m } = useI18n()
  const { Icon, tone, tilt, href } = STAMP_LOOKS[stampKey]
  const copy = m.stamps[stampKey]
  const content = (
    <div className={`relative flex aspect-[1.4] flex-col items-center justify-center overflow-hidden border-2 border-dashed border-current p-3 text-center ${STAMP_TONES[tone].className} ${tilt} ${unlocked ? '' : 'saturate-0'}`}>
      <Icon className="size-8 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-display mt-2 text-lg leading-tight tracking-wide uppercase sm:text-xl">{copy.title}</p>
      <p className="mt-1 text-xs font-semibold opacity-80">{copy.body}</p>
      {unlocked ? <CircleCheck className="absolute top-2 right-2 size-5" aria-label={m.stamps.unlocked} /> : <LockKeyhole className="absolute top-2 right-2 size-4" aria-label={m.stamps.locked} />}
      <span className="absolute -right-5 -bottom-5 size-14 rounded-full border-2 border-current opacity-25" />
    </div>
  )
  return (
    <FadeIn delay={80 + index * 60}>
      <div className="rounded-sm border-2 border-ink bg-card p-2.5 shadow-[5px_5px_0_var(--color-ink)]">
        {signedIn ? (
          <Link href={href} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">{content}</Link>
        ) : (
          <button type="button" onClick={onSignedOut} className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">{content}</button>
        )}
        {unlocked && (
          <button
            type="button"
            onClick={() => openStampShare({ stamp: stampKey, count })}
            aria-label={fmt(m.stamps.shareLabel, { title: copy.title })}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-collage-yellow px-3 text-sm font-bold text-ink transition hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Share2 className="size-4" aria-hidden="true" /> {m.stamps.share}
          </button>
        )}
      </div>
    </FadeIn>
  )
}
