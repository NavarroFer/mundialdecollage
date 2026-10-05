import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { isAnonymousRender } from '@/lib/render-mode'
import { createPublicClient } from '@/lib/supabase/public'

// Only call this after checking isSupabaseConfigured — createServerClient
// throws if the URL/anon key are missing. In an anonymous render
// (lib/render-mode.ts) there are no cookies to read: the anon-key client is
// exactly what a visitor without a session gets here anyway.
export async function createClient() {
  if (isAnonymousRender()) return createPublicClient()
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component with no write access to cookies —
            // safe to ignore as long as middleware.ts is refreshing sessions.
          }
        },
      },
    },
  )
}

// The signed-in user, verified with Supabase Auth (a network round trip) once
// per request: the home alone renders several session-aware sections, and
// each used to ask on its own. Server Components only — in a Server Action or
// route handler React's cache() doesn't memoize, so call getUser() there.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (isAnonymousRender()) return null
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  return user
})
