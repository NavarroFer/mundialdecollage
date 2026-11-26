import { NextResponse } from 'next/server'
import { cronRoute, mailAdmins } from '@/lib/cron'
import { getSelfHostedSupabaseHealth, isR2Configured } from '@/lib/supabase-monitor'

export const maxDuration = 30

// A daily read-only check of the Supabase hosted in GV Cloud and the R2 configuration.
export const GET = cronRoute(async () => {
  const supabase = await getSelfHostedSupabaseHealth()
  const r2Ready = isR2Configured()
  const issues = [
    ...(supabase.ok ? [] : [supabase.message ?? 'No se pudo verificar Supabase.']),
    ...(r2Ready ? [] : ['La caché de imágenes R2 no está configurada completamente en Producción.']),
  ]

  if (issues.length) {
    await mailAdmins(
      'Mundial de Collage · Alerta de infraestructura',
      ['Monitoreo de infraestructura · Mundial de Collage', '', 'Atención requerida:', ...issues].join('\n'),
    )
  }

  return NextResponse.json({ ok: issues.length === 0, supabase, r2Ready, issues }, { status: issues.length ? 503 : 200 })
})
