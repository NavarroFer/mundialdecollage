'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isAdminEmail, VIEW_MODE_COOKIE, type ViewMode } from '@/lib/view-mode'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Only an admin has a choice to make; for anyone else this does nothing.
export async function setViewMode(mode: ViewMode) {
  if (!isSupabaseConfigured) return
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  if (!user || !isAdminEmail(user.email)) return
  const store = await cookies()
  if (mode === 'artist') {
    store.set(VIEW_MODE_COOKIE, 'artist', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true })
  } else {
    store.delete(VIEW_MODE_COOKIE)
  }
  revalidatePath('/', 'layout')
}
