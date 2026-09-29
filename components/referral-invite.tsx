import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/track'
import { getReferralInvite } from '@/lib/referral-server'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'

// Someone who opened an artist's shared link (lib/referral.ts) is greeted as
// that artist's guest and asked, right there, to send their own obra — a
// shared link used to show the obra and nothing else, and almost nobody who
// came that way signed up. Renders nothing for anyone else.
export async function ReferralInvite({
  refParam,
  hideForSignedIn,
  className,
}: {
  /** This page's ?ref, which beats the cookie from an earlier visit. */
  refParam: unknown
  hideForSignedIn?: boolean
  className?: string
}) {
  const [invite, { m }] = await Promise.all([getReferralInvite(refParam, { hideForSignedIn }), getI18n()])
  if (!invite) return null
  const t = m.share.invite

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <p className="text-ink">
          <span className="font-semibold">{fmt(t.from, { name: invite.name })}</span>{' '}
          <span className="text-muted-foreground">{t.body}</span>
        </p>
        <Button asChild variant="primary" className="shrink-0 self-start sm:self-auto">
          <TrackedLink href="/onboarding" event="referral_invite_click">
            {t.cta}
            <ArrowRight aria-hidden="true" />
          </TrackedLink>
        </Button>
      </div>
    </div>
  )
}
