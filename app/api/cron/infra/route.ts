import { NextResponse } from 'next/server'
import { cronRoute, mailAdmins } from '@/lib/cron'
import { getSelfHostedSupabaseHealth, getSupabaseApiRequestCount, isR2Configured, needsMonthlyPlanReview, proPlanReviewText } from '@/lib/supabase-monitor'

export const maxDuration = 30

// A daily read-only check of the active Supabase services and R2 configuration.
export const GET = cronRoute(async () => {
  const selfHosted = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') === 'https://api-mundialdecollage.cloud.gvenue.com.ar'
  const supabase = selfHosted ? await getSelfHostedSupabaseHealth() : await getSupabaseApiRequestCount()
  const r2Ready = isR2Configured()
  const issues = [
    ...(supabase.ok ? [] : [supabase.message ?? 'No se pudo verificar Supabase.']),
    ...(r2Ready ? [] : ['La caché de imágenes R2 no está configurada completamente en Producción.']),
  ]
  const planReview = !selfHosted && needsMonthlyPlanReview()

  if (issues.length || planReview) {
    const lines = [
      'Monitoreo de infraestructura · Mundial de Collage',
      '',
      ...(issues.length ? ['Atención requerida:', ...issues, ''] : ['Estado: Supabase y la configuración R2 respondieron correctamente.', '']),
      ...(selfHosted ? [] : [`Solicitudes API reportadas: ${supabase.apiRequestCount ?? 'no disponible'}.`]),
      ...(planReview ? ['', proPlanReviewText()] : []),
    ]
    await mailAdmins(
      issues.length ? 'Mundial de Collage · Alerta de infraestructura' : 'Mundial de Collage · Revisión mensual de Supabase Pro',
      lines.join('\n'),
    )
  }

  return NextResponse.json({ ok: issues.length === 0, supabase, r2Ready, planReview, issues }, { status: issues.length ? 503 : 200 })
})
