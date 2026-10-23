'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { useGalleryPreferences } from '../preferences/store'
import { avatarsEnabled, CAST, portraitUrl } from '../world/people/cast'

/**
 * Who the other visitors see walking around as this one: a cast member,
 * or chance (the default). Sent along with every position (GalleryPresence).
 */
export function AvatarPicker() {
  const { avatar, update } = useGalleryPreferences()
  const t = useI18n().m.gallery.avatar
  const strip = useRef<HTMLDivElement>(null)
  // A returning visitor sees their pick, even when it's far down the strip. Only the strip scrolls, never the page.
  useEffect(() => {
    const list = strip.current
    const picked = list?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (list && picked) list.scrollLeft = picked.offsetLeft - list.offsetLeft - (list.clientWidth - picked.offsetWidth) / 2
  }, [avatar])
  if (!avatarsEnabled) return null
  const option = 'snap-start shrink-0 rounded-md border-2 p-0.5 aria-checked:border-current border-transparent focus-visible:outline-2 focus-visible:outline-offset-2'
  return (
    <section className="mt-2" aria-labelledby="gallery-avatar-title">
      <p id="gallery-avatar-title" className="text-sm font-bold">{t.title}</p>
      <p className="text-xs opacity-70">{t.hint}</p>
      <div ref={strip} role="radiogroup" aria-labelledby="gallery-avatar-title" className="relative mt-1 grid grid-flow-col grid-rows-2 auto-cols-[56px] gap-1 overflow-x-auto overscroll-x-contain snap-x snap-proximity pb-2 sm:grid-rows-1 sm:auto-cols-[60px]">
        <button type="button" role="radio" aria-checked={avatar === null} onClick={() => update({ avatar: null })}
          className={`${option} grid min-h-11 min-w-0 place-items-center h-[56px] sm:h-[64px] text-center text-xs font-bold`}>
          {t.random}
        </button>
        {CAST.map(({ name }, i) => (
          <button key={name} type="button" role="radio" aria-checked={avatar === name} aria-label={`${t.person} ${i + 1}`}
            onClick={() => update({ avatar: name })} className={`${option} flex min-h-11 min-w-0 items-center justify-center`}>
            {/* Straight from the gallery's R2 bucket: next/image would resize it on a Vercel Function. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitUrl(name)} alt="" width={64} height={81} loading="lazy" className="block h-[48px] w-auto rounded sm:h-[56px]" />
          </button>
        ))}
      </div>
    </section>
  )
}
