import { after, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { safeNextUrl } from '@/lib/safe-next'
import { trackServer } from '@/lib/track-server'

// Supabase redirects here after Google OAuth with a ?code= to exchange for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (isSupabaseConfigured && code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Recorded once the redirect is on its way, so it never slows the return.
      after(() => trackServer('login_google_return_ok', data.user?.id ?? null))
      return NextResponse.redirect(safeNextUrl(searchParams.get('next'), origin))
    }
  }

  after(() => trackServer('login_google_error', null))
  return NextResponse.redirect(`${origin}/?auth_error=1`)
}
