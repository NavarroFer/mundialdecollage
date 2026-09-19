'use client'

import { useState } from 'react'
import { CircleCheck, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchLegacyImagesBatch } from '@/app/admin/obras/actions'

// Each click walks every not-yet-fetched legacy obra photo into our own
// storage, one small batch at a time (see fetchLegacyImagesBatch) — a plain
// button + client loop instead of a cron job, since it works the same
// regardless of hosting plan and gives the admin a visible progress bar
// instead of images trickling in silently over time.
//
// Capped at 60 rounds as a hard stop: if the API ever returns attempted > 0
// with zero forward progress in a way this component didn't anticipate, the
// loop still can't run forever.
const MAX_ROUNDS = 60

export function LegacyImageSync({
  initialPending,
  initialFailed,
}: {
  initialPending: number
  initialFailed: number
}) {
  const [pending, setPending] = useState(initialPending)
  const [failed, setFailed] = useState(initialFailed)
  const [running, setRunning] = useState(false)
  const [processed, setProcessed] = useState(0)

  async function run() {
    setRunning(true)
    setProcessed(0)
    let rounds = 0
    let current = pending

    while (current > 0 && rounds < MAX_ROUNDS) {
      const result = await fetchLegacyImagesBatch()
      setProcessed((n) => n + result.attempted)
      setPending(result.pending)
      setFailed(result.failed)
      current = result.pending
      rounds++
      if (result.attempted === 0) break
    }

    setRunning(false)
  }

  if (pending === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheck className="h-4 w-4 text-collage-blue" />
        Todas las fotos que se pudieron traer ya están guardadas en el sitio, no dependen más de
        Drive.
        {failed > 0 && ` (${failed} no se pudieron traer — probablemente el link ya no es público.)`}
      </p>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button onClick={run} disabled={running} variant="outline" className="gap-2">
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Trayendo fotos… ({processed} procesadas)
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Traer {pending} fotos de Drive al sitio
          </>
        )}
      </Button>
      <p className="text-sm text-muted-foreground">
        Copia cada foto a nuestro almacenamiento para que no dependa del link de Drive.
        {failed > 0 && ` ${failed} ya fallaron antes.`}
      </p>
    </div>
  )
}
