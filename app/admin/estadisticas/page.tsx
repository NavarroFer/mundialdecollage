import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { StatBar } from '@/components/admin/stat-bar'
import { DailyActivityChart, DonutChart, FunnelChart, JourneyComparison } from '@/components/admin/dashboard-charts'
import { buildArtistCountryStats, buildArtworkStats, formatShare, type StatsArtwork } from '@/lib/artwork-stats'
import { countryCodeToName } from '@/lib/participants'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DISCOVERY_EVENTS, FUNNEL_STEPS, HOME_EVENTS, INVITE_EVENTS, ONBOARDING_EVENTS, REFERRAL_EVENTS, SHARE_EVENTS } from '@/lib/funnel'
import { adminDescription } from '@/components/admin/admin-sections'

async function getArtworkStats() {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const artworks: StatsArtwork[] = []
  // Paginate to avoid silently truncating the report at Supabase's row limit.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('artworks')
      .select('technique, profiles!inner(id, is_public, country_code)')
      .eq('is_selected', true)
      .is('archived_at', null)
      .not('image_url', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) return null
    const rows = (data ?? []) as unknown as StatsArtwork[]
    artworks.push(...rows)
    if (rows.length < 1000) break
  }
  return { artworks: buildArtworkStats(artworks), artists: buildArtistCountryStats(artworks) }
}

type FunnelCounts = Map<string, number>

function buenosAiresDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

// Distinct visitors per circuit step (lib/funnel.ts) since `days` ago.
async function getFunnel(days: number): Promise<FunnelCounts | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('funnel_summary', { since })
  if (error) return null
  return new Map(((data ?? []) as { name: string; visitors: number | string }[]).map((row) => [row.name, Number(row.visitors)]))
}

async function getGalleryHistory(days: number) {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('funnel_daily_summary', { since, event_name: 'gallery_view' })
  if (error) return null
  const byDay = new Map(((data ?? []) as { day: string; visitors: number | string }[]).map((row) => [row.day, Number(row.visitors)]))
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - index))
    const day = buenosAiresDay(date)
    return { label: date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }), value: byDay.get(day) ?? 0 }
  })
}

function FunnelSection({
  week,
  month,
  title,
  description,
  steps,
  baseStep,
  baseLabel,
  footnote,
}: {
  week: FunnelCounts | null
  month: FunnelCounts | null
  title: string
  description: string
  steps: readonly { name: string; label: string }[]
  // Without a base step the share is left out.
  baseStep?: string
  baseLabel?: string
  footnote?: string
}) {
  const base = baseStep ? month?.get(baseStep) ?? 0 : 0
  return (
    <section className="mt-10 rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl tracking-tight text-ink uppercase">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      {!week || !month ? (
        <p role="status" className="mt-6 text-sm text-collage-red">No pudimos cargar el circuito. Recargá la página para reintentar.</p>
      ) : (
        <div className="mt-6">
          <JourneyComparison
            steps={steps.map((step) => ({ label: step.label, week: week.get(step.name) ?? 0, month: month.get(step.name) ?? 0 }))}
            base={baseStep ? base : undefined}
            baseLabel={baseLabel}
          />
          {footnote && <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
        </div>
      )}
    </section>
  )
}

export default async function EstadisticasPage() {
  const [siteStats, funnelWeek, funnelMonth, galleryHistory] = await Promise.all([getArtworkStats(), getFunnel(7), getFunnel(30), getGalleryHistory(14)])
  const artworkStats = siteStats?.artworks
  const artistStats = siteStats?.artists
  const leadingCountry = artistStats?.countries.find((c) => c.countryCode !== null)
  const countryLabel = (code: string | null) => (code ? countryCodeToName(code) : 'Sin país registrado')

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" description={adminDescription('/admin/estadisticas')} />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        De dónde vienen los artistas, qué técnicas eligen, cómo avanza la publicación y cómo se mueve la gente por la galería.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="Artistas · Sitio" value={artistStats?.totalArtists ?? 'No disponible'} />
        <StatPill label="Con país registrado · Sitio" value={artistStats ? formatShare(artistStats.withCountry, artistStats.totalArtists) : 'No disponible'} />
        <StatPill label="Obras seleccionadas · Sitio" value={artworkStats?.total ?? 'No disponible'} />
        <StatPill label="Con técnica registrada · Sitio" value={artworkStats ? formatShare(artworkStats.withTechnique, artworkStats.total) : 'No disponible'} />
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
        <div className="border-b-2 border-ink/10 bg-collage-blue px-5 py-5 text-paper sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-paper/75 uppercase">Lectura rápida</p>
          <h2 className="font-display mt-1 text-2xl tracking-tight uppercase">El pulso de la convocatoria</h2>
        </div>
        <div className="grid divide-y-2 divide-ink/10 lg:grid-cols-2 lg:divide-x-2 lg:divide-y-0">
          <div className="p-5 sm:p-6">
            <h3 className="font-display text-xl tracking-tight text-ink uppercase">Actividad reciente</h3>
            <p className="mt-1 text-sm text-muted-foreground">Una lectura diaria ayuda a detectar picos después de una publicación, difusión o campaña.</p>
            <div className="mt-5">{galleryHistory ? <DailyActivityChart data={galleryHistory} /> : <p role="status" className="py-12 text-center text-sm text-collage-red">No pudimos cargar el histórico. Recargá la página para reintentar.</p>}</div>
          </div>
          <div className="p-5 sm:p-6">
            <h3 className="font-display text-xl tracking-tight text-ink uppercase">Embudo principal</h3>
            <p className="mt-1 text-sm text-muted-foreground">De abrir la galería a comenzar una participación, en los últimos 30 días.</p>
            <div className="mt-6">{funnelMonth ? <FunnelChart steps={FUNNEL_STEPS.slice(0, 5).map((step) => ({ label: step.label, value: funnelMonth.get(step.name) ?? 0 }))} /> : <p role="status" className="py-12 text-center text-sm text-collage-red">No pudimos cargar el embudo.</p>}</div>
          </div>
        </div>
      </section>

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Circuito de la galería"
        description="Personas distintas que llegaron a cada paso, del recorrido por la Galería 3D a terminar la inscripción. Cada navegador cuenta como una persona (un identificador anónimo, sin nombre ni mail). Sirve para ver dónde se cae la gente antes de armar el plan mensual. Se mide desde el 25 de septiembre de 2026."
        steps={FUNNEL_STEPS}
        baseStep="gallery_view"
        baseLabel="De quienes abrieron la galería"
        footnote="Los pasos de la home y la inscripción también cuentan a quien llegó sin pasar por la galería, por eso pueden superar a los anteriores."
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Botones de la home"
        description="Personas distintas que tocaron cada botón, para comparar cuál lleva más gente a mandar su obra. Mismo identificador anónimo que el circuito de la galería. Se mide desde el 26 de septiembre de 2026."
        steps={HOME_EVENTS}
        baseStep="home_view"
        baseLabel="De quienes abrieron la home"
        footnote="«Participar» está en el encabezado de todas las páginas, así que también cuenta a quien lo tocó fuera de la home."
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Compartir obras"
        description="Personas distintas que compartieron una obra desde su página, la tarjeta «Ya estás participando» de la home o la confirmación después de enviarla. Se mide desde el 26 de septiembre de 2026."
        steps={SHARE_EVENTS}
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Invitación después de un like o comentario"
        description="Quien da like o comenta una obra en la galería (muchas veces gente que llegó porque el artista la compartió) ve ahí mismo la invitación a mandar su propia obra. Se mide desde el 28 de septiembre de 2026."
        steps={INVITE_EVENTS}
        baseStep="artist_invite_view"
        baseLabel="De quienes vieron la invitación"
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Invitaciones de los artistas"
        description="Los links que comparten los artistas llevan su invitación: quien llega por uno ve «te invita a participar» y, si se inscribe, cuenta para ese artista. Se mide desde el 28 de septiembre de 2026."
        steps={REFERRAL_EVENTS}
        baseStep="referral_open"
        baseLabel="De quienes llegaron invitados"
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Formulario de inscripción"
        description="Cada paso dentro de /onboarding, entre tocar «Enviá tu obra» y terminar, para ver dónde se cae la gente. Se mide desde el 28 de septiembre de 2026."
        steps={ONBOARDING_EVENTS}
        baseStep="onboarding_form_view"
        baseLabel="De quienes vieron el formulario"
        footnote="Quien ya tenía la sesión iniciada llega directo al formulario, sin pasar por «Entrá con Google»."
      />

      <FunnelSection
        week={funnelWeek}
        month={funnelMonth}
        title="Descubrimiento de obras y artistas"
        description="Cómo las páginas públicas de obra y artista llevan a conocer más del proyecto o a empezar una participación."
        steps={DISCOVERY_EVENTS}
        baseStep="artwork_page_view"
        baseLabel="De quienes abrieron una obra"
      />

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
          <h2 className="font-display text-xl tracking-tight text-ink uppercase">Artistas por país</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Datos actuales del sitio: artistas con una obra seleccionada, publicada o pendiente, sin archivar.
            Cada artista cuenta una vez, con el país de su perfil.
          </p>
          {!artistStats ? (
            <p role="status" className="mt-6 text-sm text-collage-red">No pudimos cargar las estadísticas actuales. Recargá la página para reintentar.</p>
          ) : artistStats.totalArtists === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Todavía no hay artistas con una obra seleccionada.</p>
          ) : (
            <>
              {leadingCountry && (
                <p className="mt-4 rounded-xl bg-collage-blue/10 p-3 text-sm text-ink">
                  <strong>{countryLabel(leadingCountry.countryCode)}</strong> reúne el {formatShare(leadingCountry.count, artistStats.totalArtists)} de los artistas.
                </p>
              )}
              <ul className="mt-6 space-y-4" aria-label="Distribución de artistas por país">
                {artistStats.countries.map(({ countryCode, count }) => (
                  <li key={countryCode ?? 'none'}>
                    <StatBar label={countryLabel(countryCode)} value={count} maxValue={artistStats.countries[0]?.count ?? 0} total={artistStats.totalArtists} color="var(--color-collage-blue)" />
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted-foreground">
                Base: {artistStats.totalArtists} artistas. {artistStats.totalArtists - artistStats.withCountry} sin país registrado.
              </p>
            </>
          )}
        </section>

        <div className="space-y-6">
          {artworkStats && artworkStats.total > 0 && (
            <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
              <h2 className="font-display text-xl tracking-tight text-ink uppercase">Técnicas, de un vistazo</h2>
              <p className="mt-2 text-sm text-muted-foreground">La proporción de cada técnica sobre las obras seleccionadas.</p>
              <div className="mt-5"><DonutChart total={artworkStats.total} label="obras" slices={artworkStats.techniques.map((technique, index) => ({ label: technique.label, value: technique.count, color: ['var(--color-collage-red)', 'var(--color-collage-yellow)', 'var(--color-collage-blue)', 'var(--muted-foreground)'][index] ?? 'var(--muted-foreground)' }))} /></div>
            </section>
          )}
          <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl tracking-tight text-ink uppercase">Obras por técnica</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Datos actuales del sitio: obras seleccionadas, con imagen, sin archivar.
              Incluye obras publicadas y pendientes; no incluye precargas sin una obra vinculada en el sitio.
            </p>
            {!artworkStats ? (
              <p role="status" className="mt-6 text-sm text-collage-red">No pudimos cargar las estadísticas actuales. Recargá la página para reintentar.</p>
            ) : artworkStats.total === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Todavía no hay obras seleccionadas con imagen para analizar.</p>
            ) : (
              <>
                <ul className="mt-6 space-y-5" aria-label="Distribución de obras por técnica">
                  {artworkStats.techniques.map(({ label, count }) => (
                    <li key={label}>
                      <StatBar label={label} value={count} maxValue={artworkStats.techniques[0]?.count ?? 0} total={artworkStats.total} color="var(--color-collage-red)" />
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs text-muted-foreground">
                  Base: {artworkStats.total} obras. {artworkStats.total - artworkStats.withTechnique} sin técnica registrada.
                  Los porcentajes incluyen los datos faltantes.
                </p>
              </>
            )}
          </section>

          {artworkStats && artworkStats.total > 0 && (
            <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
              <h2 className="font-display text-xl tracking-tight text-ink uppercase">Estado de publicación</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sobre las mismas {artworkStats.total} obras seleccionadas del sitio.</p>
              <div className="mt-5"><DonutChart total={artworkStats.total} label="obras" slices={[{ label: 'Publicadas', value: artworkStats.published, color: 'var(--color-collage-blue)' }, { label: 'Pendientes de publicar', value: artworkStats.pending, color: 'var(--color-collage-red)' }]} /></div>
            </section>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Países cuenta artistas y técnicas cuenta obras, ambos sobre las mismas obras seleccionadas del sitio.
            Las barras de país y técnica se escalan al grupo más grande; los porcentajes usan el total de cada sección.
            Por redondeo, la suma puede diferir de 100%.
          </p>
        </div>
      </div>
    </div>
  )
}
