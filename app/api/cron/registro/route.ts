import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSheetGrid } from '@/lib/google-sheets'
import { REGISTRO_SHEET_ID, REGISTRO_TAB } from '@/lib/registro'
import { syncRegistro, type RegistroSyncReport } from '@/lib/registro-sync'
import { createResendClient, isResendConfigured } from '@/lib/resend'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site } from '@/lib/site'

// Image downloads are the slow part; anything left pending after the
// deadline is retried on the next run instead of hitting the hard timeout.
export const maxDuration = 300
const IMAGE_BUDGET_MS = 220_000
const BACKUP_BUCKET = 'registro-backups'

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Never
// passes allow_large_archive: a large removal stops and asks a human.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const startedAt = Date.now()
  const db = createAdminClient()
  try {
    const rows = await readSheetGrid(process.env.REGISTRO_SHEET_ID || REGISTRO_SHEET_ID, REGISTRO_TAB)
    const report = await syncRegistro(db, rows, {
      apply: true,
      imageDeadline: startedAt + IMAGE_BUDGET_MS,
      log: (line) => console.log(JSON.stringify(line)),
      async saveBackup(backup) {
        // Private bucket: the backup holds emails and profile data.
        await db.storage.createBucket(BACKUP_BUCKET, { public: false }).catch(() => {})
        const path = `${new Date().toISOString().replaceAll(':', '-')}.json`
        const { error } = await db.storage.from(BACKUP_BUCKET)
          .upload(path, JSON.stringify(backup), { contentType: 'application/json' })
        if (error) throw new Error(`No se guardó la copia de recuperación: ${error.message}`)
        return `${BACKUP_BUCKET}/${path}`
      },
    })

    const result = report.result as { inserted?: number; archived?: number } | undefined
    const changed = (result?.inserted ?? 0) + (result?.archived ?? 0) + report.restore + (report.published?.accounts ?? 0) > 0
    if (changed || report.images?.failed || report.published?.skipped.length) await notify(summarize(report))
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('registro sync failed', message)
    await notify(`La sincronización de Registro requiere intervención. No se aplicó ningún cambio posterior al error.\n\n${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function summarize(report: RegistroSyncReport) {
  const result = report.result as { inserted?: number; archived?: number; linked_artworks?: number } | undefined
  const images = report.images
  const lines = [
    'Sincronización de Registro aplicada.',
    '',
    `Filas en la planilla: ${report.total} (${report.contacts} emails)`,
    `Altas: ${result?.inserted ?? 0}`,
    `Restauradas: ${report.restore}`,
    `Archivadas: ${result?.archived ?? 0}`,
    `Obras vinculadas a cuentas: ${result?.linked_artworks ?? 0}`,
    `Publicadas automáticamente: ${report.published?.accounts ?? 0}${report.published?.skipped.length ? ` (${report.published.skipped.length} no se pudieron publicar, revisar en /admin/obras)` : ''}`,
    `Activas verificadas: ${report.verifiedActive}`,
    `Copia de recuperación: ${report.backupPath}`,
  ]
  if (images) {
    lines.push('', `Imágenes: ${images.downloaded} descargadas, ${images.reused} reutilizadas, ${images.failed} fallidas, ${images.deferred} para la próxima corrida.`)
    for (const row of images.failedRows) lines.push(`- ${row.name ?? '(sin nombre)'}: ${row.drive_url}`)
  }
  return lines.join('\n')
}

async function notify(text: string) {
  if (!isResendConfigured) return
  const to = process.env.REGISTRO_NOTIFY_EMAILS?.split(',').map((email) => email.trim()).filter(Boolean) ?? ADMIN_EMAILS
  const { error } = await createResendClient().emails.send({
    from: site.mailFrom,
    to,
    subject: 'Mundial de Collage · Sincronización de Registro',
    text,
  })
  if (error) console.error('registro sync notify failed', error)
}
