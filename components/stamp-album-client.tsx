'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, CircleCheck, Compass, LockKeyhole, Scissors, Send, X } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { useI18n } from '@/lib/i18n/client'
import { MAP_SECTION_ID } from '@/lib/map-country-link'

const TUTORIAL_KEY = 'mundial-stamps-tutorial-seen'
const stamps = [
  { key: 'first', href: '/onboarding', Icon: Send, tone: 'bg-collage-red text-paper -rotate-3' },
  { key: 'gallery', href: '/galeria-3d', Icon: Scissors, tone: 'bg-collage-yellow text-ink rotate-2' },
  { key: 'world', href: `#${MAP_SECTION_ID}`, Icon: Compass, tone: 'bg-collage-blue text-paper -rotate-1' },
] as const

export function StampAlbumClient({ signedIn, unlockedStamps }: { signedIn: boolean; unlockedStamps: string[] }) {
  const { m } = useI18n()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const copy = { first: m.stamps.first, gallery: m.stamps.gallery, world: m.stamps.world }

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
            </>}
          </div>
        </div>
      )}
    </>
  )
}
