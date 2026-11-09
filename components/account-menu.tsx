'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { DoorOpen, LogOut, ShieldCheck, Store, User } from 'lucide-react'
import { GoogleIcon, useGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/track'

export type AccountMenuLabels = {
  account: string
  hello: string
  myGallery: string
  shop: string
  adminPanel: string
}

export type AccountMenuProps = {
  labels: AccountMenuLabels
  // Signed in or not: the menu also serves visitors (shop, language, sign in).
  signedIn: boolean
  name?: string
  // The artist's public profile, when they have one.
  profileHref?: string
  // Thumbnail of the artist's obra: their avatar, as Google shows a photo.
  thumbUrl?: string
  isAdmin?: boolean
}

const ITEM =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-collage-blue'

function Avatar({ name, thumbUrl, signedIn, size }: { name?: string; thumbUrl?: string; signedIn: boolean; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-base'
  if (thumbUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imageSrc already serves a small CDN-cached derivative
      <img src={imageSrc(thumbUrl, 128)} alt="" width={64} height={64} className={`${box} shrink-0 rounded-full object-cover ring-2 ring-ink/15`} />
    )
  }
  const initial = name?.trim().charAt(0).toUpperCase()
  return (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-ink/15 ${signedIn && initial ? 'bg-collage-blue text-paper' : 'bg-paper text-ink/70'}`}>
      {signedIn && initial ? initial : <User className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} aria-hidden="true" />}
    </span>
  )
}

// The avatar at the top right, like Google's: it opens a card with the
// artist's thumbnail, their profile and everything the phone's tab bar has
// no room for (shop, language, the Club gallery, sign out).
export function AccountMenu({ labels, signedIn, name, profileHref, thumbUrl, isAdmin }: AccountMenuProps) {
  const { m } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const { loading, start } = useGoogleSignIn('/onboarding')

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function signOut() {
    await createClient().auth.signOut()
    setOpen(false)
    router.refresh()
  }

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        aria-label={name ? `${labels.account}: ${name}` : labels.account}
        className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 ease-out hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue motion-reduce:transition-none"
      >
        <Avatar name={name} thumbUrl={thumbUrl} signedIn={signedIn} size="sm" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] origin-top-right rounded-3xl border-2 border-ink/10 bg-paper p-2 shadow-[0_16px_40px_color-mix(in_srgb,var(--ink)_16%,transparent)] animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          {signedIn && (
            <>
              <div className="flex items-center gap-3 px-3 pb-3 pt-2">
                <Avatar name={name} thumbUrl={thumbUrl} signedIn size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">{name ?? labels.hello}</p>
                  {profileHref && (
                    <Link
                      href={profileHref}
                      prefetch={false}
                      onClick={() => {
                        track('header_profile_click')
                        close()
                      }}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-collage-blue underline-offset-4 hover:underline"
                    >
                      {m.common.viewMyProfile}
                    </Link>
                  )}
                </div>
              </div>
              <div className="my-1 h-px bg-ink/10" />
              <Link href="/mi-galeria" prefetch={false} onClick={close} className={ITEM}>
                <DoorOpen className="h-5 w-5 text-ink/70" aria-hidden="true" />
                {labels.myGallery}
              </Link>
            </>
          )}
          <Link href="/tienda" onClick={() => { track('store_click_header'); close() }} className={ITEM}>
            <Store className="h-5 w-5 text-ink/70" aria-hidden="true" />
            {labels.shop}
          </Link>
          {isAdmin && (
            <Link href="/admin/estadisticas" onClick={close} className={ITEM}>
              <ShieldCheck className="h-5 w-5 text-ink/70" aria-hidden="true" />
              {labels.adminPanel}
            </Link>
          )}
          {/* The desktop header already shows the language switcher. */}
          <div className="lg:hidden">
            <LanguageSwitcher className="w-full rounded-xl px-3 text-[15px] text-ink hover:bg-ink/[0.06] [&>svg]:h-5 [&>svg]:w-5" />
          </div>
          <div className="my-1 h-px bg-ink/10" />
          {signedIn ? (
            <button type="button" onClick={() => void signOut()} className={ITEM}>
              <LogOut className="h-5 w-5 text-ink/70" aria-hidden="true" />
              {m.auth.signOut}
            </button>
          ) : (
            <button type="button" onClick={() => void start()} disabled={loading} className={`${ITEM} disabled:opacity-60`}>
              <GoogleIcon />
              {loading ? m.auth.signingIn : m.auth.signIn}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
