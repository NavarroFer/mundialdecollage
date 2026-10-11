'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Artwork } from '@/data/artworks'
import { GoogleIcon } from '@/components/auth/google-sign-in-button'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useI18n } from '@/lib/i18n/client'
import { track } from '@/lib/track'
import { Game } from './Game'

/** The server only provides artworks after verifying a user. */
export function GalleryAccess({ artworks, userId }: { artworks: Artwork[]; userId: string }) {
  const [signedIn, setSignedIn] = useState(true)
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setSignedIn(session?.user.id === userId)
    })
    return () => data.subscription.unsubscribe()
  }, [userId])
  return signedIn ? <Game artworks={artworks} /> : <GallerySignIn />
}

export function GallerySignIn() {
  const { locale, m } = useI18n()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { track('gallery_view') }, [])
  const t = m.gallery.access
  async function signIn() {
    setBusy(true)
    setFailed(false)
    try {
      if (!isSupabaseConfigured) throw new Error('unavailable')
      const next = `/${locale}/galeria-3d${window.location.search}`
      const client = createClient()
      // A cached anonymous entry can still be open in a tab after login.
      const { data: { user } } = await client.auth.getUser()
      if (user) {
        // Force a fresh server auth check instead of reusing an anonymous RSC cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(next)
        return
      }
      track('sign_in_start')
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      } })
      if (error) throw error
    } catch { setFailed(true); setBusy(false) }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <section className="w-full max-w-lg space-y-5 rounded-3xl border-2 border-ink/10 bg-card p-7 text-center">
      <p className="text-xs font-bold uppercase tracking-widest">{m.gallery.startEyebrow}</p>
      <h1 className="font-display text-3xl">{t.title}</h1>
      <p>{t.body}</p>
      <button type="button" onClick={() => void signIn()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border border-current px-5 disabled:opacity-60"><GoogleIcon />{busy ? m.auth.signingIn : m.auth.signIn}</button>
      {failed && <p role="alert">{t.error}</p>}
      <p className="text-sm text-muted-foreground">{t.measurement}</p>
      <Link href="/politica-de-privacidad" className="block text-sm underline">{t.privacy}</Link>
      <Link href="/" className="block text-sm underline">{m.gallery.homeLink}</Link>
    </section>
  </main>
}
