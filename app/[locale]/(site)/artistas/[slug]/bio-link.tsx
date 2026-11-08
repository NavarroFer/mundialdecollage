'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Copy, Download, Link2 } from 'lucide-react'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'

const pill =
  'inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30'

// Only the profile's owner sees this: the link to paste in an Instagram bio
// and a QR code to print or post. The QR is drawn here in the browser, with
// the library loaded on demand, so neither costs the server anything.
const noopSubscribe = () => () => {}

export function BioLink({ slug }: { slug: string }) {
  const { m } = useI18n()
  const t = m.artistProfile
  // The origin only exists in the browser: empty on the server render, then
  // read once on the client without a state update inside an effect.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '')
  const url = origin ? `${origin}/artistas/${slug}` : ''
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }))
      .then((data) => { if (!cancelled) setQr(data) })
      .catch(() => { /* The link still works without its QR. */ })
    return () => { cancelled = true }
  }, [url])

  async function copy() {
    setCopied(false)
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(url)
      track('profile_bio_link_copied')
      setCopied(true)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border-2 border-ink/10 bg-paper p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-display flex items-center gap-2 text-xl tracking-tight text-ink uppercase">
          <Link2 className="h-5 w-5 text-collage-blue" aria-hidden="true" />
          {t.bioTitle}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t.bioBody}</p>
        <p className="mt-3 rounded-lg bg-card px-3 py-2 font-mono text-xs break-all text-ink">{url}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={pill} onClick={() => void copy()} disabled={!url}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {m.share.copyLink}
          </button>
          {qr && (
            <a href={qr} download="mi-perfil-mundial-de-collage-qr.png" className={pill} onClick={() => track('profile_qr_download')}>
              <Download className="h-4 w-4 text-collage-red" aria-hidden="true" />
              {t.bioQr}
            </a>
          )}
          {copied && <span role="status" className="text-sm text-muted-foreground">{m.share.copied}</span>}
        </div>
        {copyError && <p role="alert" className="mt-3 text-sm text-collage-red">{m.share.copyFailed}</p>}
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={t.bioQrAlt} width={144} height={144} className="mx-auto size-36 shrink-0 rounded-lg bg-white" />
      )}
    </div>
  )
}
