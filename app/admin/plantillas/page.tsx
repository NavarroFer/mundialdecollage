import Link from 'next/link'
import { Plus, Pencil, Trash2, Copy, Languages, Search, Zap, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { TranslationBadge } from '@/components/admin/translation-badge'
import { translationState } from '@/lib/email-translation'
import { isTranslatorConfigured } from '@/lib/email-translator'
import { ensureSystemTemplate, isSystemTemplateKey, SYSTEM_TEMPLATES } from '@/lib/system-templates'
import { deleteTemplate, duplicateTemplate, translateTemplate } from './actions'
import { adminDescription } from '@/components/admin/admin-sections'
import { isEmailDocument, renderEmailDocumentToHtml, renderEmailPreviewHtml } from '@/lib/email-blocks'
import { TEMPLATE_AUDIENCES, audienceMeta, isTemplateAudience } from '@/lib/template-audiences'
import { cn } from '@/lib/utils'

// Translating a template into eight languages takes a little while.
export const maxDuration = 120

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; publico?: string; envio?: string; q?: string }>
}) {
  const { error, publico, envio, q } = await searchParams
  const audience = isTemplateAudience(publico) ? publico : null
  const sending = envio === 'automatica' || envio === 'campanas' ? envio : null
  const query = (q ?? '').trim()
  const supabase = await createClient()
  // The automatic mails' templates are created on first sight, so they can
  // be reviewed and edited before the cron ever sends them.
  await Promise.all(Object.keys(SYSTEM_TEMPLATES).map((key) =>
    isSystemTemplateKey(key) && ensureSystemTemplate(supabase, key).catch((err) => console.error(`ensureSystemTemplate(${key}) failed:`, err)),
  ))
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, subject, body_html, updated_at, body_json, translations, translations_source, system_key, audiences')
    .order('updated_at', { ascending: false })

  const all = (templates ?? []).map((t) => ({ ...t, audiences: (t.audiences ?? []) as string[], translation: translationState(t) }))
  // Each filter's counts take the other filters into account, so a number
  // always says what clicking it would show.
  const matchesSending = (t: (typeof all)[number]) => !sending || (sending === 'automatica') === Boolean(t.system_key)
  const matchesAudience = (t: (typeof all)[number], value: string | null) =>
    !value || (value === 'sin' ? t.audiences.length === 0 : t.audiences.includes(value))
  const needle = query.toLocaleLowerCase('es')
  const matchesQuery = (t: (typeof all)[number]) => !needle || `${t.name} ${t.subject}`.toLocaleLowerCase('es').includes(needle)
  const list = all.filter((t) => matchesSending(t) && matchesAudience(t, publico === 'sin' ? 'sin' : audience) && matchesQuery(t))
  const audienceCount = (value: string | null) => all.filter((t) => matchesSending(t) && matchesQuery(t) && matchesAudience(t, value)).length
  const sendingCount = (value: 'automatica' | 'campanas' | null) =>
    all.filter((t) => (!value || (value === 'automatica') === Boolean(t.system_key)) && matchesAudience(t, publico === 'sin' ? 'sin' : audience) && matchesQuery(t)).length
  const href = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams()
    const next = { publico: publico ?? null, envio: sending, q: query || null, ...changes }
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const qs = params.toString()
    return qs ? `/admin/plantillas?${qs}` : '/admin/plantillas'
  }
  const filtered = Boolean(publico || sending || query)
  const pill = (active: boolean) => cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
    active ? 'bg-collage-blue text-primary-foreground' : 'text-muted-foreground hover:text-ink',
  )

  return (
    <div>
      <AdminPageHeader
        eyebrow="Newsletter"
        title="Plantillas"
        description={adminDescription('/admin/plantillas')}
        action={
          <Link href="/admin/plantillas/nueva">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </Link>
        }
      />

      {!isTranslatorConfigured && (
        <p className="mt-4 rounded-xl border-2 border-collage-yellow/50 bg-collage-yellow/15 px-4 py-3 text-sm text-ink">
          Las plantillas se traducen solas al guardarlas una vez que esté configurada ANTHROPIC_API_KEY en Vercel.
          Mientras tanto, las que no tengan traducción se envían en español a todos.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {/* Catalogue: who it's for first (the question asked most), then how
          it goes out, and a search by name or subject. */}
      <section className="mt-8 rounded-2xl border-2 border-ink/10 bg-card" aria-label="Filtrar plantillas">
        <div className="px-3 pt-3 pb-2 sm:px-4">
          <p className="mb-1.5 text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">Público</p>
          <nav className="flex flex-wrap gap-1 rounded-2xl border-2 border-ink/10 bg-background p-1">
            <Link href={href({ publico: null })} className={pill(!publico)}>Todas <span className="opacity-70">{audienceCount(null)}</span></Link>
            {TEMPLATE_AUDIENCES.map((a) => (
              <Link key={a.value} href={href({ publico: a.value })} title={a.description} className={pill(publico === a.value)}>
                {a.label} <span className="opacity-70">{audienceCount(a.value)}</span>
              </Link>
            ))}
            <Link href={href({ publico: 'sin' })} className={pill(publico === 'sin')}>Sin etiqueta <span className="opacity-70">{audienceCount('sin')}</span></Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t-2 border-ink/10 px-3 py-3 sm:px-4">
          <div>
            <p className="mb-1.5 text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">Envío</p>
            <nav className="flex flex-wrap rounded-full border-2 border-ink/10 bg-background p-0.5">
              <Link href={href({ envio: null })} className={pill(!sending)}>Todas <span className="opacity-70">{sendingCount(null)}</span></Link>
              <Link href={href({ envio: 'automatica' })} className={pill(sending === 'automatica')} title="Las manda el sitio solo">Automáticas <span className="opacity-70">{sendingCount('automatica')}</span></Link>
              <Link href={href({ envio: 'campanas' })} className={pill(sending === 'campanas')} title="Las que se mandan desde Campañas">Para campañas <span className="opacity-70">{sendingCount('campanas')}</span></Link>
            </nav>
          </div>
          <form action="/admin/plantillas" className="flex min-w-56 flex-1 items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-4 py-2 text-sm focus-within:border-ink/40">
            {publico && <input type="hidden" name="publico" value={publico} />}
            {sending && <input type="hidden" name="envio" value={sending} />}
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <label className="sr-only" htmlFor="template-search">Buscar plantillas</label>
            <input id="template-search" name="q" type="search" defaultValue={query} placeholder="Buscar por nombre o asunto" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink/10 px-3 py-2.5 text-sm sm:px-4">
          <p className="font-semibold text-ink">{filtered ? `${list.length} de ${all.length} plantillas` : `${all.length} plantillas`}</p>
          {filtered && (
            <Link href="/admin/plantillas" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-ink hover:underline">
              <X className="h-3 w-3" aria-hidden />Limpiar filtros
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {all.length === 0 && (
          <p className="text-muted-foreground sm:col-span-2 xl:col-span-3">Todavía no creaste ninguna plantilla.</p>
        )}
        {all.length > 0 && list.length === 0 && (
          <p className="text-muted-foreground sm:col-span-2 xl:col-span-3">No hay plantillas con esos filtros.</p>
        )}
        {list.map((t) => {
          const emailHtml = isEmailDocument(t.body_json) ? renderEmailDocumentToHtml(t.body_json) : t.body_html
          const previewHtml = renderEmailPreviewHtml(emailHtml)

          return (
            <div key={t.id} className="overflow-hidden rounded-2xl border-2 border-ink/10 bg-card">
              <div className="aspect-[4/3] overflow-hidden border-b-2 border-ink/10 bg-white">
                <iframe
                  title={`Vista previa de ${t.name}`}
                  srcDoc={previewHtml}
                  sandbox=""
                  tabIndex={-1}
                  className="pointer-events-none h-[300%] w-[300%] origin-top-left scale-[0.3334] border-0"
                />
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-ink">{t.name}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.subject}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {t.system_key && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-collage-yellow px-2 py-0.5 text-[0.7rem] font-bold text-ink" title="La manda el sitio solo">
                      <Zap className="h-3 w-3" aria-hidden />Automática
                    </span>
                  )}
                  {t.audiences.map((value) => {
                    const meta = audienceMeta(value)
                    return meta && (
                      <Link key={value} href={href({ publico: value })} className={cn('rounded-full px-2 py-0.5 text-[0.7rem] font-bold hover:opacity-80', meta.className)}>
                        {meta.label}
                      </Link>
                    )
                  })}
                  {t.audiences.length === 0 && <span className="rounded-full border border-dashed border-ink/25 px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">Sin etiqueta</span>}
                </div>
                <div className="mt-2">
                  <TranslationBadge status={t.translation.status} locales={t.translation.locales} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isTranslatorConfigured && (t.translation.status === 'untranslated' || t.translation.status === 'outdated') && (
                    <form action={translateTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Traduciendo…">
                        <Languages className="h-3.5 w-3.5" />
                        Traducir
                      </SubmitButton>
                    </form>
                  )}
                  <Link href={`/admin/plantillas/${t.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </Link>
                  <form action={duplicateTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingLabel="Duplicando…">
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </SubmitButton>
                  </form>
                  {!t.system_key && (
                    <form action={deleteTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-collage-red hover:bg-collage-red/10 hover:text-collage-red"
                        pendingLabel="Borrando…"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
