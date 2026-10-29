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

/**
 * Why a campaign cannot go out yet, or null. The Club's launch mail links to
 * /club, which does not exist while the Club is closed.
 */
export function campaignBlockedByClub(audience: string): string | null {
  return audience === 'club_prospects' && !isClubOpen()
    ? 'El Club todavía está cerrado (falta CLUB_OPEN=on): abrilo antes de mandar esta campaña, porque el botón llevaría a una página que no existe.'
    : null
}
