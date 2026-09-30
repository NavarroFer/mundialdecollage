'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, CircleCheck, Compass, LockKeyhole, Scissors, Send, X } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { useI18n } from '@/lib/i18n/client'
import { MAP_SECTION_ID } from '@/lib/map-country-link'
import { STAMP_UNLOCKED_EVENT, type StampKey } from '@/lib/stamps'
import type { CollectedArtworkStamp } from '@/components/stamp-album'

const TUTORIAL_KEY = 'mundial-stamps-tutorial-seen'
const stamps = [
  { key: 'first', href: '/onboarding', Icon: Send, tone: 'bg-collage-red text-paper -rotate-3' },
  { key: 'gallery', href: '/galeria-3d', Icon: Scissors, tone: 'bg-collage-yellow text-ink rotate-2' },
  { key: 'world', href: `#${MAP_SECTION_ID}`, Icon: Compass, tone: 'bg-collage-blue text-paper -rotate-1' },
] as const

export function StampAlbumClient({ signedIn, unlockedStamps: initialUnlockedStamps, artworkStamps }: { signedIn: boolean; unlockedStamps: string[]; artworkStamps: CollectedArtworkStamp[] }) {
  const { m } = useI18n()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [unlockedStamps, setUnlockedStamps] = useState(initialUnlockedStamps)
  const [collectedArtworkStamps, setCollectedArtworkStamps] = useState(artworkStamps)
  const copy = { first: m.stamps.first, gallery: m.stamps.gallery, world: m.stamps.world }

  const syncStamps = useCallback(async () => {
    const response = await fetch('/api/stamps', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json() as { signedIn: boolean; unlockedStamps: string[]; artworkStamps: CollectedArtworkStamp[] }
    if (data.signedIn) {
      setUnlockedStamps(data.unlockedStamps)
      setCollectedArtworkStamps(data.artworkStamps)
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
      const stamp = (event as CustomEvent<StampKey>).detail
      setUnlockedStamps((current) => current.includes(stamp) ? current : [...current, stamp])
      setAlbumOpen(true)
    }
    window.addEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
    return () => window.removeEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
  }, [])

  useEffect(() => {
    if (signedIn || window.localStorage.getItem(TUTORIAL_KEY)) return
    window.localStorage.setItem(TUTORIAL_KEY, '1')
    const frame = window.requestAnimationFrame(() => setTutorialOpen(true))
    return () => window.cancelAnimationFrame(frame)
  }, [signedIn])

  return (
    <>
      <button type="button" onClick={() => { setTutorialOpen(false); setAlbumOpen(true) }} className="fixed right-3 bottom-5 z-40 flex items-center gap-2 rounded-full border-2 border-ink bg-collage-yellow px-4 py-3 text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue sm:right-6" aria-label={m.stamps.title}>
        <BookOpen className="size-5" aria-hidden="true" /> <span className="hidden sm:inline">{m.stamps.eyebrow}</span><span className="rounded-full border border-ink/25 bg-paper px-1.5 py-0.5 text-xs tabular-nums">{unlockedStamps.length}/3</span>
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
              <p className="mt-2 max-w-xl text-muted-foreground">{m.stamps.body}</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-3">
          {stamps.map(({ key, href, Icon, tone }, index) => {
            const unlocked = unlockedStamps.includes(key)
            const content = (
              <div className={`relative flex aspect-[1.4] flex-col items-center justify-center overflow-hidden border-2 border-dashed border-current p-3 text-center ${tone} ${unlocked ? '' : 'saturate-0'}`}>
                <Icon className="size-8 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12" strokeWidth={1.5} aria-hidden="true" />
                <p className="font-display mt-2 text-xl tracking-wide uppercase">{copy[key].title}</p>
                <p className="mt-1 text-xs font-semibold opacity-80">{copy[key].body}</p>
                {unlocked ? <CircleCheck className="absolute top-2 right-2 size-5" aria-label={m.stamps.title} /> : <LockKeyhole className="absolute top-2 right-2 size-4" aria-label={m.stamps.locked} />}
                <span className="absolute -right-5 -bottom-5 size-14 rounded-full border-2 border-current opacity-25" />
              </div>
            )
            return (
              <FadeIn key={key} delay={100 + index * 100}>
                {signedIn ? (
                  <Link href={href} className="group block rounded-sm border-2 border-ink bg-card p-3 shadow-[5px_5px_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:rotate-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">{content}</Link>
                ) : (
                  <button type="button" onClick={() => setTutorialOpen(true)} className="group block w-full rounded-sm border-2 border-ink bg-card p-3 text-left shadow-[5px_5px_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:rotate-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">{content}</button>
                )}
              </FadeIn>
            )
          })}
              </div>
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
            </>}
          </div>
        </div>
      )}
    </>
  )
}
