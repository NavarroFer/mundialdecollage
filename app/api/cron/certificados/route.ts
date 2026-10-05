import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronRoute, errorMessage } from '@/lib/cron'
import { loadCertificateOverview, sendCertificates } from '@/lib/certificate-mail'

export const maxDuration = 300

// Vercel Cron calls this at 00:15 UTC, right after both providers' daily
// quotas start over, with `Authorization: Bearer $CRON_SECRET`. Once the call
// is closed it sends the certificates still pending or failed, as many as
// today's quota allows (lib/certificate-mail.ts); the rest wait for the next
// night. Nothing to do while the call is open or once everyone has theirs.
// `?dry=1` reports what's pending without sending.
export const GET = cronRoute(async ({ dryRun }) => {
  const db = createAdminClient()
  const { data: state, error: stateError } = await db.from('call_state').select('closed_at').eq('id', true).maybeSingle()
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 })
  if (!state?.closed_at) return NextResponse.json({ skipped: 'La convocatoria sigue abierta' })

  try {
    if (dryRun) {
      const { toSend } = await loadCertificateOverview(db)
      return NextResponse.json({ dryRun: true, pending: toSend.length })
    }
    const result = await sendCertificates(db)
    if (result.failed) console.error('certificados: some sends failed', result)
    return NextResponse.json(result, { status: result.failed && !result.sent ? 500 : 200 })
  } catch (err) {
    console.error('certificados cron failed', err)
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
})
