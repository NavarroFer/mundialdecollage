import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Public, unauthenticated on purpose — anyone with a contact's id (the one
// stamped into their unsubscribe link) can opt themselves out. Uses the
// service-role client since there's no admin session here; the only write
// this route can ever make is `subscribed = false` on a single row.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id || !isSupabaseConfigured) {
    return new NextResponse('Falta el identificador.', { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase.from('contacts').update({ subscribed: false }).eq('id', id)

  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><body style="font-family: sans-serif; padding: 40px; text-align: center;"><h1>Listo, te diste de baja</h1><p>No vas a recibir más mails del Mundial de Collage.</p></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
