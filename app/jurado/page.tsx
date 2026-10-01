import type { Metadata } from 'next'
import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getJuryPool, isAdminUser, jurorFor } from '@/lib/jury'
import { ScoreCard } from './score-card'

export const metadata: Metadata = { title: 'Jurado', robots: { index: false } }

// The jury's own page: sign in with Google, and if that email is an active
// juror (added from /admin/jurado), score every preselected obra, blind.
// ?pendientes=1 shows only the ones not scored yet.
export default async function JuradoPage({ searchParams }: { searchParams: Promise<{ pendientes?: string }> }) {
  const { pendientes } = await searchParams
  const onlyPending = pendientes === '1'
  const user = isSupabaseConfigured ? (await (await createClient()).auth.getUser()).data.user : null

  if (!user) {
    return (
      <Shell>
        <p className="text-muted-foreground">Entrá con la cuenta de Google con la que te invitamos a ser jurado.</p>
        <div className="mt-6"><GoogleSignInButton next="/jurado" /></div>
      </Shell>
    )
  }

  const db = createAdminClient()
  const juror = await jurorFor(db, user)
  if (!juror) {
    return (
      <Shell>
        <p className="text-muted-foreground">
          La cuenta <strong className="text-ink">{user.email}</strong> no está habilitada como jurado.
          {isAdminUser(user) ? <> Podés sumarte desde <Link href="/admin/jurado" className="underline">Jurado en el panel</Link>.</> : ' Si te invitamos con otro mail, salí y entrá con esa cuenta.'}
        </p>
      </Shell>
    )
  }

  const [pool, { data: scores }] = await Promise.all([
    getJuryPool(db),
    db.from('jury_scores').select('item_key, score, comment').eq('juror_id', juror.id),
  ])
  const mine = new Map((scores ?? []).map((row) => [row.item_key, row]))
  const scored = pool.filter((item) => mine.has(item.key)).length
  // Numbered on the full pool, so «#12» is the same obra with or without the filter.
  const items = pool.map((item, i) => ({ item, index: i + 1 })).filter(({ item }) => !onlyPending || !mine.has(item.key))

  return (
    <Shell>
      <p className="text-muted-foreground">
        Hola{juror.name ? `, ${juror.name}` : ''}. Puntuá cada obra del 1 al 10; se guarda al tocar el número. Las obras se muestran sin el nombre ni el país de quien las hizo.
      </p>
      <div className="sticky top-0 z-10 -mx-5 mt-6 flex flex-wrap items-center justify-between gap-3 border-y-2 border-ink/10 bg-background/95 px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border-2">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-semibold text-ink">Puntuaste {scored} de {pool.length}</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-collage-blue" style={{ width: `${pool.length ? (scored / pool.length) * 100 : 0}%` }} />
          </div>
        </div>
        <Link href={onlyPending ? '/jurado' : '/jurado?pendientes=1'} className="rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30">
          {onlyPending ? 'Ver todas' : 'Solo las que faltan'}
        </Link>
      </div>

      {pool.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">Todavía no hay obras para evaluar.</p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center font-semibold text-collage-blue">¡Ya puntuaste todas! Gracias.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {items.map(({ item, index }) => {
            const score = mine.get(item.key)
            return (
              <ScoreCard
                key={item.key}
                itemKey={item.key}
                index={index}
                imageUrl={item.imageUrl}
                title={item.title}
                technique={item.technique}
                initialScore={score?.score ?? null}
                initialComment={score?.comment ?? null}
              />
            )
          })}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="bg-grain min-h-screen py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-collage-red uppercase"><Gavel className="size-4" aria-hidden />Jurado</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight text-ink uppercase">Evaluación de obras</h1>
          <div className="mt-4">{children}</div>
        </div>
      </main>
    </>
  )
}
