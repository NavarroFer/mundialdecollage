import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { adminDescription } from '@/components/admin/admin-sections'
import { SubmitButton } from '@/components/admin/submit-button'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { FINALISTS, getJuryPool, rankJuryPool, type ScoreRow } from '@/lib/jury'
import { site } from '@/lib/site'
import { addJuror, setJurorActive } from './actions'

// Jury MVP: who judges, how far along each juror is, and the ranking of the
// preselected obras by average score, with the cut at the 30 finalists.
// The pool is whatever is «Preseleccionada» in /admin/obras. Read with the
// service role (the layout already gated this page to admins).
export default async function JuradoAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const db = createAdminClient()
  const [pool, jurorsResult, scoresResult] = await Promise.all([
    getJuryPool(db),
    db.from('jurors').select('id, email, name, active, created_at').order('created_at'),
    db.from('jury_scores').select('juror_id, item_key, score, comment'),
  ])
  const jurors = jurorsResult.data ?? []
  const scores = (scoresResult.data ?? []) as ScoreRow[]
  const active = jurors.filter((j) => j.active)
  const ranked = rankJuryPool(pool, scores, new Set(active.map((j) => j.id)))
  const poolKeys = new Set(pool.map((item) => item.key))
  const progress = (jurorId: string) => scores.filter((s) => s.juror_id === jurorId && poolKeys.has(s.item_key)).length
  const complete = active.filter((j) => pool.length > 0 && progress(j.id) >= pool.length).length

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Jurado" description={adminDescription('/admin/jurado')} />
      {(error || jurorsResult.error || scoresResult.error) && (
        <p role="alert" className="mt-4 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error ?? jurorsResult.error?.message ?? scoresResult.error?.message}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Obras preseleccionadas" value={`${pool.length} de ${site.jury.poolSize}`} />
        <StatPill label="Jurados activos" value={active.length} />
        <StatPill label="Terminaron de puntuar" value={`${complete} de ${active.length}`} />
      </div>
      {pool.length !== site.jury.poolSize && (
        <p className="mt-3 rounded-lg bg-collage-yellow/20 p-3 text-sm text-ink">
          {pool.length < site.jury.poolSize
            ? `Faltan ${site.jury.poolSize - pool.length} obras para completar la curaduría de ${site.jury.poolSize}.`
            : `Hay ${pool.length - site.jury.poolSize} obras de más: la curaduría es de ${site.jury.poolSize}.`}{' '}
          Se preseleccionan en <Link href="/admin/obras" className="underline">Obras</Link>.
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Las obras a evaluar son las <Link href="/admin/obras" className="underline">preseleccionadas</Link>. Cada jurado entra con Google a{' '}
        <Link href="/jurado" className="font-semibold underline">/jurado</Link> y las puntúa del 1 al 10, sin ver el nombre ni el país del artista, cada jurado en su propio orden al azar.
      </p>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]" aria-labelledby="jurors-title">
        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5">
          <h2 id="jurors-title" className="font-display text-xl tracking-tight text-ink uppercase">Sumar un jurado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Con el mail de la cuenta de Google con la que va a entrar.</p>
          <form action={addJuror} className="mt-4 space-y-3">
            <input name="email" type="email" required placeholder="email@gmail.com" className="w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
            <input name="name" placeholder="Nombre (opcional)" maxLength={120} className="w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm" />
            <SubmitButton size="sm">Agregar</SubmitButton>
          </form>
        </div>
        <div className="overflow-x-auto rounded-2xl border-2 border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr><th className="px-4 py-3">Jurado</th><th className="px-4 py-3">Avance</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {jurors.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Todavía no hay jurados.</td></tr>}
              {jurors.map((j) => (
                <tr key={j.id} className={`border-t border-ink/10 ${j.active ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3"><p className="font-medium text-ink">{j.name ?? '—'}</p><p className="text-muted-foreground">{j.email}</p></td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{progress(j.id)} / {pool.length}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={setJurorActive}>
                      <input type="hidden" name="id" value={j.id} />
                      <input type="hidden" name="active" value={j.active ? '0' : '1'} />
                      <SubmitButton size="sm" variant="outline">{j.active ? 'Desactivar' : 'Reactivar'}</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="ranking-title">
        <h2 id="ranking-title" className="font-display text-2xl tracking-tight text-ink uppercase">Ranking</h2>
        <p className="mt-1 text-sm text-muted-foreground">Por puntaje promedio de los jurados activos; a igual promedio, la que tiene más votos. La línea marca las {FINALISTS} finalistas.</p>
        <ol className="mt-4 space-y-2">
          {ranked.length === 0 && <li className="rounded-2xl border-2 border-ink/10 p-6 text-center text-muted-foreground">Preseleccioná obras en /admin/obras para que el jurado las evalúe.</li>}
          {ranked.map((item, i) => (
            <li key={item.key}>
              {i === FINALISTS && <p className="my-4 border-t-4 border-dashed border-collage-red pt-2 text-xs font-bold tracking-[0.16em] text-collage-red uppercase">Corte de finalistas</p>}
              <div className={`flex items-center gap-4 rounded-xl border-2 p-3 ${i < FINALISTS && item.votes > 0 ? 'border-collage-blue/30 bg-collage-blue/5' : 'border-ink/10 bg-card'}`}>
                <span className="w-8 shrink-0 text-right font-display text-xl text-ink">{i + 1}</span>
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-ink/10 bg-paper">
                  <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-contain p-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink"><span className="mr-1.5 text-muted-foreground">#{item.number}</span>{item.title?.trim() || 'Sin título'}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.countryCode && <span aria-hidden>{countryCodeToFlag(item.countryCode)} </span>}
                    {item.artist ?? '—'}{item.countryCode ? ` · ${countryCodeToName(item.countryCode)}` : ''}{item.technique ? ` · ${item.technique}` : ''}
                  </p>
                  {item.comments.length > 0 && (
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-collage-blue">{item.comments.length} {item.comments.length === 1 ? 'comentario' : 'comentarios'}</summary>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{item.comments.map((c, k) => <li key={k}>{c}</li>)}</ul>
                    </details>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl text-ink">{item.average === null ? '—' : item.average.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{item.votes} de {active.length} votos</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
