import { ADMIN_EMAILS } from '@/lib/admin'

// The Club stays closed until the owner opens it: CLUB_OPEN=on in the
// environment (and a redeploy). Closed, its public pages, the home banner
// and the sitemap entry are absent and nobody can subscribe, buy coins or
// edit; the site's admins still can, so the whole flow can be tried with real
// accounts before launch. Galleries that already exist stay where they are.
export const isClubOpen = () => process.env.CLUB_OPEN === 'on'

export function canUseClub(email: string | null | undefined): boolean {
  return isClubOpen() || ADMIN_EMAILS.includes(email ?? '')
}
