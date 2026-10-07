'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ObraViewer } from '@/components/admin/obra-viewer'
import { getAdminSubmissionDetails } from '@/app/[locale]/(site)/admin/obras/actions'
import type { Submission } from '@/components/admin/submission-types'

export function SubmissionViewerLoader({ id, revision, onClose }: { id: string; revision: unknown; onClose: () => void }) {
  const [result, setResult] = useState<{ submission?: Submission; error?: string }>({})
  useEffect(() => {
    let cancelled = false
    getAdminSubmissionDetails(id).then(submission => {
      if (!cancelled) setResult(submission ? { submission } : { error: 'La obra ya no está disponible.' })
    }).catch(() => {
      if (!cancelled) setResult({ error: 'No se pudo cargar la obra. Cerrá y volvé a intentar.' })
    })
    return () => { cancelled = true }
  }, [id, revision])

  if (result.submission) {
    return <ObraViewer items={[result.submission]} activeIndex={0} onActiveIndexChange={onClose} />
  }
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogTitle>{result.error ? 'No se pudo abrir la obra' : 'Cargando obra'}</DialogTitle>
        <p role={result.error ? 'alert' : 'status'} className="flex items-center gap-2 text-sm text-muted-foreground">
          {!result.error && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {result.error ?? 'Buscando los datos y la imagen de esta obra…'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
