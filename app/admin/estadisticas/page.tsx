import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { CollapsibleSection } from '@/components/admin/collapsible-section'
import { StatBar } from '@/components/admin/stat-bar'
import { ArtworkHistoryChart, DailyActivityChart, FunnelChart, JourneyComparison } from '@/components/admin/dashboard-charts'
import { buildArtistCountryStats, buildArtworkStats, formatShare, type StatsArtwork } from '@/lib/artwork-stats'
import { countryCodeToName } from '@/lib/participants'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DISCOVERY_EVENTS, GALLERY_HAPPY_PATH, HOME_EVENTS, INVITE_EVENTS, ONBOARDING_FORM_EVENTS, REFERRAL_EVENTS, SHARE_EVENTS, SOUVENIR_EVENTS, MAGAZINE_ENTRY_EVENTS, MAGAZINE_FUNNEL_EVENTS, STORE_ENTRY_EVENTS, STORE_FUNNEL_EVENTS, WAITLIST_EVENTS } from '@/lib/funnel'
import { adminDescription } from '@/components/admin/admin-sections'
import { getSubmissionsCount } from '@/lib/submissions'

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

type HistoryGrouping = 'day' | 'week' | 'month'

async function getSubmissionHistory(days: number, grouping: HistoryGrouping) {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('submission_history', { since, granularity: grouping })
  if (error) return null
  return ((data ?? []) as { bucket: string; works: number | string }[]).map(({ bucket, works }) => {
    const date = new Date(`${bucket}T12:00:00-03:00`)
    const options: Intl.DateTimeFormatOptions = grouping === 'month'
      ? { month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }
      : grouping === 'week'
        ? { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }
        : { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }
    return { label: date.toLocaleDateString('es-AR', options), value: Number(works) }
  })
}

function JourneySection({
  week,
  month,
  title,
  description,
  steps,
  baseStep,
  baseLabel,
  footnote,
  periodDays,
  variant = 'funnel',
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
  periodDays: number
  variant?: 'funnel' | 'comparison'
}) {
  const base = baseStep ? month?.get(baseStep) ?? 0 : 0
  const primaryStep = baseStep ?? steps[0]?.name
  const primaryCount = primaryStep && month ? month.get(primaryStep) ?? 0 : null
  const recentPrimaryCount = primaryStep && week ? week.get(primaryStep) ?? 0 : null
  const finalCount = month?.get(steps.at(-1)?.name ?? '') ?? 0
  const completion = baseStep && base > 0 ? finalCount / base : undefined
  const comparisonDays = periodDays === 7 ? 1 : 7
  return (
    <CollapsibleSection
      title={title}
      description={description}
      steps={steps.length}
      kpi={primaryCount}
      kpiLabel={steps.find((step) => step.name === primaryStep)?.label ?? 'Personas'}
      recentKpi={recentPrimaryCount}
      comparisonDays={comparisonDays}
      completion={completion}
    >
      {!week || !month ? (
        <p role="status" className="text-sm text-collage-red">No pudimos cargar el circuito. Recargá la página para reintentar.</p>
      ) : (
        <div>
          <JourneyComparison
            steps={steps.map((step) => ({ label: step.label, week: week.get(step.name) ?? 0, month: month.get(step.name) ?? 0 }))}
            base={baseStep ? base : undefined}
            baseLabel={baseLabel}
            periodDays={periodDays}
            comparisonDays={comparisonDays}
            variant={variant}
          />
          {footnote && <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
        </div>
      )}
    </CollapsibleSection>
  )
}

const PERIODS = [7, 30, 90] as const

export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ period?: string; grouping?: string }> }) {
  const { period, grouping: requestedGrouping } = await searchParams
  const periodDays = PERIODS.includes(Number(period) as (typeof PERIODS)[number]) ? Number(period) : 30
  const grouping: HistoryGrouping = requestedGrouping === 'week' || requestedGrouping === 'month' ? requestedGrouping : 'day'
  const comparisonDays = periodDays === 7 ? 1 : 7
  const [siteStats, receivedCount, funnelWeek, funnelMonth, galleryHistory, submissionHistory] = await Promise.all([getArtworkStats(), getSubmissionsCount(), getFunnel(comparisonDays), getFunnel(periodDays), getGalleryHistory(periodDays), getSubmissionHistory(periodDays, grouping)])
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
      <nav aria-label="Período de estadísticas" className="mt-5 flex flex-wrap gap-2">
        {PERIODS.map((days) => (
          <Link key={days} href={`/admin/estadisticas?period=${days}&grouping=${grouping}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${days === periodDays ? 'bg-collage-blue text-primary-foreground' : 'bg-card text-muted-foreground hover:text-ink'}`}>
            Últimos {days} días
          </Link>
        ))}
      </nav>
      <section className="mt-6 grid gap-3 lg:grid-cols-12" aria-label="Panorama de la convocatoria">
        <div className="relative overflow-hidden rounded-3xl bg-collage-blue p-6 text-paper lg:col-span-4">
          <p className="text-xs font-bold tracking-[0.18em] text-paper/70 uppercase">Panorama general</p>
          <p className="font-display mt-3 text-6xl leading-none tracking-tight">{receivedCount}</p>
          <p className="mt-2 text-sm font-semibold uppercase">Obras recibidas</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/75">Cada envío cuenta: incluye obras de la planilla y registros directos desde la página.</p>
          <div className="absolute -right-9 -bottom-12 h-40 w-40 rounded-full border-[18px] border-paper/10" aria-hidden />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
          <StatPill label="Artistas · Sitio" value={artistStats?.totalArtists ?? 'No disponible'} />
          <StatPill label="Obras seleccionadas · Sitio" value={artworkStats?.total ?? 'No disponible'} />
          <StatPill label="Con país registrado" value={artistStats ? formatShare(artistStats.withCountry, artistStats.totalArtists) : 'No disponible'} />
          <StatPill label="Con técnica registrada" value={artworkStats ? formatShare(artworkStats.withTechnique, artworkStats.total) : 'No disponible'} />
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border-2 border-ink/10 bg-card" aria-labelledby="submission-history-title">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-collage-red uppercase">Obras recibidas</p>
            <h2 id="submission-history-title" className="font-display mt-1 text-2xl tracking-tight text-ink uppercase">Histórico de participaciones</h2>
            <p className="mt-1 text-sm text-muted-foreground">Incluye envíos desde Registro y participaciones directas, sin duplicarlas.</p>
          </div>
          <nav aria-label="Agrupación del histórico de obras" className="flex rounded-full bg-muted p-1">
            {(['day', 'week', 'month'] as const).map((option) => {
              const label = option === 'day' ? 'Diario' : option === 'week' ? 'Semanal' : 'Mensual'
              return <Link key={option} href={`/admin/estadisticas?period=${periodDays}&grouping=${option}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${grouping === option ? 'bg-collage-red text-primary-foreground' : 'text-muted-foreground hover:text-ink'}`}>{label}</Link>
            })}
          </nav>
        </div>
        <div className="p-5 sm:p-6">
          {submissionHistory ? <ArtworkHistoryChart data={submissionHistory} grouping={grouping} /> : <p role="status" className="py-12 text-center text-sm text-collage-red">No pudimos cargar el histórico de obras. Recargá la página para reintentar.</p>}
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
        <div className="border-b-2 border-ink/10 bg-collage-blue px-5 py-5 text-paper sm:px-6">
          <p className="text-xs font-bold tracking-[0.18em] text-paper/75 uppercase">Lectura rápida</p>
          <h2 className="font-display mt-1 text-2xl tracking-tight uppercase">El pulso de la convocatoria</h2>
        </div>
        <div className="grid divide-y-2 divide-ink/10 lg:grid-cols-2 lg:divide-x-2 lg:divide-y-0">
          <div className="p-5 sm:p-6">
            <h3 className="font-display text-xl tracking-tight text-ink uppercase">Actividad reciente</h3>
            <p className="mt-1 text-sm text-muted-foreground">Una lectura diaria ayuda a detectar picos después de una publicación, difusión o campaña.</p>
            <div className="mt-5">{galleryHistory ? <DailyActivityChart data={galleryHistory} days={periodDays} /> : <p role="status" className="py-12 text-center text-sm text-collage-red">No pudimos cargar el histórico. Recargá la página para reintentar.</p>}</div>
          </div>
          <div className="p-5 sm:p-6">
            <h3 className="font-display text-xl tracking-tight text-ink uppercase">Embudo principal</h3>
            <p className="mt-1 text-sm text-muted-foreground">El camino principal para descubrir obras, en los últimos {periodDays} días.</p>
            <div className="mt-6">{funnelMonth ? <FunnelChart periodDays={periodDays} steps={GALLERY_HAPPY_PATH.map((step) => ({ label: step.label, value: funnelMonth.get(step.name) ?? 0 }))} /> : <p role="status" className="py-12 text-center text-sm text-collage-red">No pudimos cargar el embudo.</p>}</div>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="linear-journeys-title">
        <div className="border-l-4 border-collage-blue pl-4">
          <p className="text-xs font-bold tracking-[0.18em] text-collage-blue uppercase">Recorridos lineales</p>
          <h2 id="linear-journeys-title" className="font-display mt-1 text-2xl tracking-tight text-ink uppercase">Embudos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Etapas consecutivas: cada bloque muestra el avance del mismo camino.</p>
        </div>

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Circuito de la galería"
        description="El camino central de descubrimiento: abrir la Galería 3D, entrar a recorrerla y descubrir una obra. Cada navegador cuenta una vez, con un identificador anónimo. Se mide desde el 25 de septiembre de 2026."
        steps={GALLERY_HAPPY_PATH}
        baseStep="gallery_view"
        baseLabel="De quienes abrieron la galería"
        periodDays={periodDays}
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Invitación después de un like o comentario"
        description="Quien da like o comenta una obra en la galería (muchas veces gente que llegó porque el artista la compartió) ve ahí mismo la invitación a mandar su propia obra. Se mide desde el 28 de septiembre de 2026."
        steps={INVITE_EVENTS}
        baseStep="artist_invite_view"
        baseLabel="De quienes vieron la invitación"
        periodDays={periodDays}
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Invitaciones de los artistas"
        description="Los links que comparten los artistas llevan su invitación: quien llega por uno ve «te invita a participar» y, si se inscribe, cuenta para ese artista. Se mide desde el 28 de septiembre de 2026."
        steps={REFERRAL_EVENTS}
        baseStep="referral_open"
        baseLabel="De quienes llegaron invitados"
        periodDays={periodDays}
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Formulario de inscripción"
        description="El recorrido lineal dentro del formulario: desde verlo hasta tocar «Enviar». Se mide desde el 28 de septiembre de 2026."
        steps={ONBOARDING_FORM_EVENTS}
        baseStep="onboarding_form_view"
        baseLabel="De quienes vieron el formulario"
        periodDays={periodDays}
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Tienda"
        description="Desde abrir la tienda hasta que PayPal aprueba la suscripción, para ver en qué paso se pierde la venta. Se mide desde el 1 de octubre de 2026."
        steps={STORE_FUNNEL_EVENTS}
        baseStep="store_view"
        baseLabel="De quienes abrieron la tienda"
        periodDays={periodDays}
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Preventa de la revista"
        description="Desde abrir /revista hasta pagar con Mercado Pago. Mientras la preventa no tenga precio, la página junta mails (ver «Avisame»). Se mide desde el 1 de octubre de 2026."
        steps={MAGAZINE_FUNNEL_EVENTS}
        baseStep="magazine_view"
        baseLabel="De quienes abrieron la revista"
        periodDays={periodDays}
      />

      </section>

      <section className="mt-14" aria-labelledby="action-comparisons-title">
        <div className="border-l-4 border-collage-red pl-4">
          <p className="text-xs font-bold tracking-[0.18em] text-collage-red uppercase">Acciones alternativas</p>
          <h2 id="action-comparisons-title" className="font-display mt-1 text-2xl tracking-tight text-ink uppercase">Comparativas</h2>
          <p className="mt-1 text-sm text-muted-foreground">No son pasos consecutivos: sirven para comparar qué acción genera más movimiento.</p>
        </div>

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Botones de la home"
        description="Personas distintas que tocaron cada botón, para comparar cuál lleva más gente a mandar su obra. Mismo identificador anónimo que el circuito de la galería. Se mide desde el 26 de septiembre de 2026."
        steps={HOME_EVENTS}
        baseStep="home_view"
        baseLabel="De quienes abrieron la home"
        footnote="«Participar» está en el encabezado de todas las páginas, así que también cuenta a quien lo tocó fuera de la home."
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Compartir obras"
        description="Personas distintas que compartieron una obra desde su página, la tarjeta «Ya estás participando» de la home o la confirmación después de enviarla. Se mide desde el 26 de septiembre de 2026."
        steps={SHARE_EVENTS}
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Foto souvenir de la galería"
        description="Personas distintas que sacaron una foto en la Galería 3D (botón de la cámara o tecla F) y qué hicieron con ella. Se mide desde el 2 de octubre de 2026."
        steps={SOUVENIR_EVENTS}
        baseStep="souvenir_photo"
        baseLabel="De quienes sacaron una foto"
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Descubrimiento de obras y artistas"
        description="Cómo las páginas públicas de obra y artista llevan a conocer más del proyecto o a empezar una participación."
        steps={DISCOVERY_EVENTS}
        baseStep="artwork_page_view"
        baseLabel="De quienes abrieron una obra"
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Cómo llegan a la tienda"
        description="Personas distintas que fueron a la tienda desde el encabezado, una página de obra o el mail diario «Así le fue a tu obra». Se mide desde el 1 de octubre de 2026."
        steps={STORE_ENTRY_EVENTS}
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="Cómo llegan a la revista"
        description="Personas distintas que fueron a /revista desde la tienda, después de inscribirse o desde la tarjeta «Ya estás participando» de la home. Se mide desde el 1 de octubre de 2026."
        steps={MAGAZINE_ENTRY_EVENTS}
        periodDays={periodDays}
        variant="comparison"
      />

      <JourneySection
        week={funnelWeek}
        month={funnelMonth}
        title="«Avisame» de finalistas y revista"
        description="Personas que dejaron su mail para enterarse de las finalistas y la revista, según dónde lo hicieron. Quedan en Contactos con el origen «aviso_…». Se mide desde el 1 de octubre de 2026."
        steps={WAITLIST_EVENTS}
        periodDays={periodDays}
        variant="comparison"
      />
      </section>

      <div className="mt-12 grid items-start gap-6 xl:grid-cols-12">
        <section className="rounded-3xl border-2 border-ink/10 bg-card p-5 sm:p-6 xl:col-span-5">
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
              <ul className="mt-6 max-h-96 space-y-5 overflow-y-auto pr-3" aria-label="Distribución de artistas por país">
                {artistStats.countries.map(({ countryCode, count }) => (
                  <li key={countryCode ?? 'missing-country'}>
                    <StatBar
                      label={countryLabel(countryCode)}
                      value={count}
                      maxValue={artistStats.countries[0]?.count ?? 0}
                      total={artistStats.totalArtists}
                      color="var(--color-collage-blue)"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted-foreground">
                Base: {artistStats.totalArtists} artistas. {artistStats.totalArtists - artistStats.withCountry} sin país registrado.
              </p>
            </>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2 xl:col-span-7">
          {artworkStats && artworkStats.total > 0 && (
            <section className="relative overflow-hidden rounded-3xl border-2 border-ink/10 bg-card p-5 sm:p-6">
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-collage-red/10" aria-hidden="true" />
              <h2 className="font-display relative text-xl tracking-tight text-ink uppercase">Datos de técnica</h2>
              <p className="relative mt-2 text-sm text-muted-foreground">Una señal rápida de qué tan completo está este dato.</p>
              <div className="relative mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <strong className="font-display text-5xl leading-none tracking-tight text-collage-red">{formatShare(artworkStats.total - artworkStats.withTechnique, artworkStats.total)}</strong>
                    <p className="mt-2 max-w-52 text-sm font-semibold leading-snug text-ink">sin técnica registrada</p>
                  </div>
                  <span className="rounded-full bg-collage-yellow px-3 py-1.5 text-xs font-bold text-ink">{artworkStats.withTechnique} completas</span>
                </div>
                <div className="mt-5 h-4 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-collage-red" style={{ width: `${((artworkStats.total - artworkStats.withTechnique) / artworkStats.total) * 100}%` }} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{artworkStats.total - artworkStats.withTechnique} de {artworkStats.total} obras necesitan completar este dato. El desglose de técnicas está abajo.</p>
              </div>
            </section>
          )}
          <section className="rounded-3xl border-2 border-ink/10 bg-card p-5 sm:p-6 md:col-span-2">
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
            <section className="relative overflow-hidden rounded-3xl border-2 border-ink/10 bg-card p-5 sm:p-6 md:col-start-2 md:row-start-1">
              <div className="absolute -right-7 -bottom-10 h-36 w-36 rounded-full border-[18px] border-collage-blue/10" aria-hidden="true" />
              <h2 className="font-display relative text-xl tracking-tight text-ink uppercase">Estado de publicación</h2>
              <p className="relative mt-2 text-sm text-muted-foreground">Sobre las mismas {artworkStats.total} obras seleccionadas del sitio.</p>
              <div className="relative mt-6 flex items-end justify-between gap-4">
                <div>
                  <strong className="font-display text-5xl leading-none tracking-tight text-collage-blue">{artworkStats.published}</strong>
                  <p className="mt-2 text-sm font-semibold text-ink">obras publicadas</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${artworkStats.pending === 0 ? 'bg-collage-blue text-primary-foreground' : 'bg-collage-red text-primary-foreground'}`}>
                  {artworkStats.pending === 0 ? 'Todo al día' : `${artworkStats.pending} pendientes`}
                </span>
              </div>
              <div className="relative mt-5 h-4 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-collage-blue" style={{ width: `${(artworkStats.published / artworkStats.total) * 100}%` }} />
              </div>
              <p className="relative mt-3 text-xs leading-relaxed text-muted-foreground">
                {artworkStats.pending === 0
                  ? 'Las obras seleccionadas ya están visibles en el sitio.'
                  : `${artworkStats.pending} obras todavía no están visibles para el público.`}
              </p>
            </section>
          )}
          <p className="md:col-span-2 text-xs leading-relaxed text-muted-foreground">
            Países cuenta artistas y técnicas cuenta obras, ambos sobre las mismas obras seleccionadas del sitio.
            Las barras de país y técnica se escalan al grupo más grande; los porcentajes usan el total de cada sección.
            Por redondeo, la suma puede diferir de 100%.
          </p>
        </div>
      </div>
    </div>
  )
}
import Link from 'next/link'
