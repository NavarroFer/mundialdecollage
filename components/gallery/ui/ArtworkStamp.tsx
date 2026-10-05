'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Stamp } from 'lucide-react'
import { collectArtworkStamp, type ArtworkStampResult } from '@/app/[locale]/(site)/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { galleryReturnPath } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useInteractionStore } from '../interaction/store'

export function ArtworkStamp({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [result, setResult] = useState<ArtworkStampResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [askSignIn, setAskSignIn] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

  const save = useCallback(async () => {
    if (busyRef.current || result?.status === 'collected' || result?.status === 'already_collected') return
    if (!signedIn) {
      setAskSignIn(true)
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const next = await collectArtworkStamp(slug)
      if ('error' in next) {
        if (next.error === 'sign_in_required') setAskSignIn(true)
        else setError('No pudimos guardar la estampilla. Probá de nuevo.')
        return
      }
      setResult(next)
      track('artwork_stamp_saved')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [result, signedIn, slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (useInteractionStore.getState().consumeIntent(slug, 'stamp') && signedIn) void save()
  }, [save, signedIn, slug])

  const signIn = async () => {
    setBusy(true)
    await startGoogleSignIn(galleryReturnPath({ slug, intent: 'stamp' }))
  }

  const label = result?.status === 'collected' ? 'Estampilla guardada' : result?.status === 'already_collected' ? 'Ya la guardaste' : result?.status === 'limit_reached' ? 'Volvé cuando se renueve el álbum' : busy ? 'Guardando…' : 'Guardar estampilla'

  return (
    <div className="mt-3 space-y-2">
      <button type="button" onClick={() => void save()} disabled={busy || result?.status === 'collected' || result?.status === 'already_collected'} className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-collage-yellow px-5 py-3 font-semibold text-ink disabled:opacity-60">
        <Stamp className="size-5" aria-hidden="true" /> {label}
      </button>
      {result?.status === 'limit_reached' && <p role="status" className="text-sm text-muted-foreground">Ya guardaste 3 obras en las últimas 12 horas.</p>}
      {result && result.status !== 'limit_reached' && <p role="status" className="text-sm text-muted-foreground">Te quedan {result.remaining} de 3 estampillas para esta tanda.</p>}
      {askSignIn && !signedIn && (
        <div className="space-y-2 rounded-xl border border-ink/15 p-4">
          <p className="text-sm font-semibold">Ingresá para guardar esta obra en tu álbum.</p>
          <button type="button" onClick={() => void signIn()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"><GoogleIcon />Ingresar con Google</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
