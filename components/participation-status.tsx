import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'

// Shown right under the hero for a returning, already-submitted artist —
// "cuando esté logueado cada artista, que diga 'Ya estás participando' y les
// muestre su obra." Renders nothing for logged-out visitors, admins (they
// never submit an artwork, see lib/admin.ts), and logged-in users who
// haven't finished onboarding yet — that "you haven't submitted" case is
// intentionally out of scope here.
export async function ParticipationStatus() {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (ADMIN_EMAILS.includes(user.email ?? '')) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, artwork_title, artwork_slug, artwork_image_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarded_at) return null
  // Defensive: onboarding always fills these together (see
  // app/onboarding/actions.ts), but don't render a broken card if a row is
  // ever left in a partial state.
  if (!profile.artwork_title || !profile.artwork_slug || !profile.artwork_image_url) return null

  return (
    <section className="border-t-2 border-ink/10 bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <div className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card p-5 sm:flex-row sm:gap-8 sm:p-6">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border-2 border-ink/10 bg-muted sm:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.artwork_image_url}
                alt={profile.artwork_title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="torn-strip inline-flex -rotate-1 items-center gap-1.5 bg-collage-blue px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ya estás participando
              </span>

              <h2 className="font-display mt-4 text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {profile.artwork_title}
              </h2>

              <p className="mt-2 text-muted-foreground">
                Tu obra ya forma parte del Mundial de Collage.
              </p>

              <Link href={`/obras/${profile.artwork_slug}`} className="mt-5 inline-block">
                <Button variant="outline" className="gap-2">
                  Ver mi obra
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
