import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { isMailConfigured, sendMail } from '@/lib/mail'
import { getSupabaseApiRequestCount, isR2Configured, needsMonthlyPlanReview, proPlanReviewText } from '@/lib/supabase-monitor'

export const maxDuration = 30

// A small daily external check: catch a rejected Supabase plan/token before
// visitors discover it through missing gallery images. It never changes either
// provider; it only mails the two administrators when action is warranted.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await getSupabaseApiRequestCount()
  const r2Ready = isR2Configured()
  const issues = [
    ...(supabase.ok ? [] : [supabase.message ?? 'No se pudo verificar Supabase.']),
    ...(r2Ready ? [] : ['La caché de imágenes R2 no está configurada completamente en Producción.']),
  ]
  const planReview = needsMonthlyPlanReview()

  if ((issues.length || planReview) && isMailConfigured) {
    const lines = [
      'Monitoreo de infraestructura · Mundial de Collage',
      '',
      ...(issues.length ? ['Atención requerida:', ...issues, ''] : ['Estado: Supabase Usage Analytics y la configuración R2 respondieron correctamente.', '']),
      `Solicitudes API reportadas: ${supabase.apiRequestCount ?? 'no disponible'}.`,
      ...(planReview ? ['', proPlanReviewText()] : []),
    ]
    const result = await sendMail({
      to: ADMIN_EMAILS,
      subject: issues.length ? 'Mundial de Collage · Alerta de infraestructura' : 'Mundial de Collage · Revisión mensual de Supabase Pro',
      text: lines.join('\n'),
    })
    if (!result.ok) console.error('infrastructure monitor notify failed', result.error)
  }

  return NextResponse.json({ ok: issues.length === 0, supabase, r2Ready, planReview, issues }, { status: issues.length ? 503 : 200 })
}
