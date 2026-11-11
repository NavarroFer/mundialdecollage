import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ADMIN_EMAILS } from '@/lib/admin'

// An admin account can also look at the site the way an artist does: the
// header shows their profile, «Mi galería» and «Mis datos» work, the terms
// prompt and the sign-up nudge appear. It is only a view: what an admin may
// do is still decided by their email (lib/admin.ts, RLS), never by this cookie.
export const VIEW_MODE_COOKIE = 'view_as'
export type ViewMode = 'admin' | 'artist'

export const isAdminEmail = (email: string | null | undefined) => ADMIN_EMAILS.includes(email ?? '')

// «Is this person seen as an admin right now?». Cookies are read only once the
// user is known to be an admin: nobody else pays for it, and the anonymous
// copies (which have no user) stay static.
export async function isAdminView(user: User | null): Promise<boolean> {
  if (!user || !isAdminEmail(user.email)) return false
  return (await cookies()).get(VIEW_MODE_COOKIE)?.value !== 'artist'
}
