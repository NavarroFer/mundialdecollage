import { NextResponse } from 'next/server'
import { cronRoute, mailAdmins } from '@/lib/cron'
import { getSupabaseApiRequestCount, isR2Configured, needsMonthlyPlanReview, proPlanReviewText } from '@/lib/supabase-monitor'

export const maxDuration = 30

// A small daily external check: catch a rejected Supabase plan/token before
// visitors discover it through missing gallery images. It never changes either
// provider; it only mails the two administrators when action is warranted.
export const GET = cronRoute(async () => {
  const supabase = await getSupabaseApiRequestCount()
  const r2Ready = isR2Configured()
  const issues = [
    ...(supabase.ok ? [] : [supabase.message ?? 'No se pudo verificar Supabase.']),
    ...(r2Ready ? [] : ['La caché de imágenes R2 no está configurada completamente en Producción.']),
  ]
  const planReview = needsMonthlyPlanReview()

  if (issues.length || planReview) {
    const lines = [
      'Monitoreo de infraestructura · Mundial de Collage',
      '',
      ...(issues.length ? ['Atención requerida:', ...issues, ''] : ['Estado: Supabase Usage Analytics y la configuración R2 respondieron correctamente.', '']),
      `Solicitudes API reportadas: ${supabase.apiRequestCount ?? 'no disponible'}.`,
      ...(planReview ? ['', proPlanReviewText()] : []),
    ]
    await mailAdmins(
      issues.length ? 'Mundial de Collage · Alerta de infraestructura' : 'Mundial de Collage · Revisión mensual de Supabase Pro',
      lines.join('\n'),
    )
  }

  return NextResponse.json({ ok: issues.length === 0, supabase, r2Ready, planReview, issues }, { status: issues.length ? 503 : 200 })
})
