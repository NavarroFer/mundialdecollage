import { GalleryAttentionStats } from '@/components/admin/gallery-attention-stats'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { BarList, FunnelChart, Meter, type Windows } from '@/components/admin/stats/bar-charts'
import { ChartFrame, type ChartFigure } from '@/components/admin/stats/chart-frame'
import { ChartError, EmptyChart } from '@/components/admin/stats/chart-kit'
import { StatsControlBar, StatsSection } from '@/components/admin/stats/control-bar'
import { Segmented } from '@/components/admin/stats/controls'
import { StatsBusyArea } from '@/components/admin/stats/navigation'
import { TimeSeriesChart } from '@/components/admin/stats/time-series-chart'
import { StatsViewProvider } from '@/components/admin/stats/view-settings'
import { buildArtistCountryStats, buildArtworkStats, formatShare, type StatsArtwork } from '@/lib/artwork-stats'
import { formatCount } from '@/lib/chart-math'
import { countryCodeToName } from '@/lib/participants'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DISCOVERY_EVENTS, FORM_RESCUE_EVENTS, GALLERY_HAPPY_PATH, GALLERY_READY_EVENTS, HOME_EVENTS, INVITE_EVENTS, LOGIN_EVENTS, ONBOARDING_FORM_EVENTS, SIGNUP_SOURCE_EVENTS, REFERRAL_EVENTS, SHARE_EVENTS, SOUVENIR_EVENTS, WALL_EVENTS, MAGAZINE_ENTRY_EVENTS, MAGAZINE_FUNNEL_EVENTS, PARTNER_EVENTS, STORE_ENTRY_EVENTS, STORE_FUNNEL_EVENTS, WAITLIST_EVENTS } from '@/lib/funnel'
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

// Which app's browser the visits came from: funnel_events.in_app, recorded
// since October 12, 2026 (earlier steps count as «Otros»).
const BROWSERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'otros', label: 'Otros' },
] as const
type Browser = (typeof BROWSERS)[number]['value']

// Distinct visitors per circuit step (lib/funnel.ts) since `days` ago, from
// every browser or one kind (funnel_summary_by_browser).
async function getFunnel(days: number, browser: Browser): Promise<FunnelCounts | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = browser === 'todos'
    ? await supabase.rpc('funnel_summary', { since })
    : await supabase.rpc('funnel_summary_by_browser', { since, browser: browser === 'otros' ? 'other' : browser })
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
      : { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }
    return { label: date.toLocaleDateString('es-AR', options), value: Number(works) }
  })
}

const percent = (share: number) => new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 }).format(share)
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

function JourneySection({
  week,
  month,
  title,
  description,
  steps,
  baseStep,
  baseLabel,
  figureLabel,
  footnote,
  windows,
  recentDays,
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
  // The headline's label when the base isn't one of the steps shown.
  figureLabel?: string
  footnote?: string
  windows: Windows
  recentDays: number
  variant?: 'funnel' | 'comparison'
}) {
  const base = baseStep ? month?.get(baseStep) ?? 0 : undefined
  const primaryStep = baseStep ?? steps[0]?.name
  const primaryCount = primaryStep && month ? month.get(primaryStep) ?? 0 : null
  const recentPrimaryCount = primaryStep && week ? week.get(primaryStep) ?? 0 : null
  const finalCount = month?.get(steps.at(-1)?.name ?? '') ?? 0
  const completion = baseStep && base ? finalCount / base : undefined
  const figure: ChartFigure | undefined = primaryCount === null ? undefined : {
    value: formatCount(primaryCount),
    label: steps.find((step) => step.name === primaryStep)?.label ?? figureLabel ?? 'Personas',
    details: [
      ...(recentPrimaryCount !== null ? [{ label: `${formatCount(recentPrimaryCount)} · ${recentDays} d`, series: 'recent' as const }] : []),
      ...(completion !== undefined && variant === 'funnel' ? [{ label: `${percent(completion)} al final` }] : []),
    ],
  }
  const rows = steps.map((step) => ({ label: step.label, value: month?.get(step.name) ?? 0, recent: week?.get(step.name) ?? 0 }))
  const note = baseLabel ? `% ${lowerFirst(baseLabel)}.` : undefined
  return (
    <ChartFrame level={3} title={title} description={description} footnote={footnote} figure={figure} controls={['compare']}>
      {!week || !month ? <ChartError>No pudimos cargar el circuito. Recargá la página para reintentar.</ChartError>
        : variant === 'funnel'
          ? <FunnelChart steps={rows} base={base} label={`${title}, ${lowerFirst(windows.period)}`} note={note} windows={windows} />
          : <BarList rows={rows} total={base} label={`${title}, ${lowerFirst(windows.period)}`} note={note} windows={windows} />}
    </ChartFrame>
  )
}

const PERIODS = [7, 30, 90] as const

function statsHref({ period, grouping, browser }: { period: number; grouping: HistoryGrouping; browser: Browser }) {
  return `/admin/estadisticas?period=${period}&grouping=${grouping}${browser === 'todos' ? '' : `&navegador=${browser}`}`
}

export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ period?: string; grouping?: string; navegador?: string }> }) {
  const { period, grouping: requestedGrouping, navegador } = await searchParams
  const browser: Browser = BROWSERS.find((option) => option.value === navegador)?.value ?? 'todos'
  const periodDays = PERIODS.includes(Number(period) as (typeof PERIODS)[number]) ? Number(period) : 30
  const grouping: HistoryGrouping = requestedGrouping === 'week' || requestedGrouping === 'month' ? requestedGrouping : 'day'
  const comparisonDays = periodDays === 7 ? 1 : 7
  const windows: Windows = { period: `Últimos ${periodDays} días`, recent: comparisonDays === 1 ? 'Último día' : `Últimos ${comparisonDays} días` }
  const [siteStats, receivedCount, funnelWeek, funnelMonth, galleryHistory, submissionHistory] = await Promise.all([getArtworkStats(), getSubmissionsCount(), getFunnel(comparisonDays, browser), getFunnel(periodDays, browser), getGalleryHistory(periodDays), getSubmissionHistory(periodDays, grouping)])
  const artworkStats = siteStats?.artworks
  const artistStats = siteStats?.artists
  const leadingCountry = artistStats?.countries.find((c) => c.countryCode !== null)
  const countryLabel = (code: string | null) => (code ? countryCodeToName(code) : 'Sin país registrado')
  const historyUnit = grouping === 'day' ? 'día' : grouping === 'week' ? 'semana' : 'mes'
  const journey = { week: funnelWeek, month: funnelMonth, windows, recentDays: comparisonDays }
  const sum = (points: { value: number }[]) => points.reduce((total, point) => total + point.value, 0)
  // The meters need a whole to measure against.
  const meterStats = artworkStats && artworkStats.total > 0 ? artworkStats : null

  return (
    <StatsViewProvider periodLabel={windows.period}>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" description={adminDescription('/admin/estadisticas')} />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        De dónde vienen los artistas, qué técnicas eligen, cómo avanza la publicación y cómo se mueve la gente por la galería.
      </p>
      <StatsControlBar
        periodDays={periodDays}
        periods={PERIODS.map((days) => ({ days, href: statsHref({ period: days, grouping, browser }) }))}
        browser={browser}
        browsers={BROWSERS.map(({ value, label }) => ({ value, label, href: statsHref({ period: periodDays, grouping, browser: value }) }))}
      />
      <StatsBusyArea>
        <section className="mt-6 grid gap-3 lg:grid-cols-12" aria-label="Panorama de la convocatoria">
          <div className="relative overflow-hidden rounded-3xl bg-collage-blue p-6 text-paper lg:col-span-4">
            <p className="text-xs font-bold tracking-[0.18em] text-paper/70 uppercase">Panorama general</p>
            <p className="font-display mt-3 text-6xl leading-none tracking-tight">{receivedCount}</p>
            <p className="mt-2 text-sm font-semibold uppercase">Obras recibidas</p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/75">Cada envío cuenta: incluye obras de la planilla y registros directos desde la página.</p>
            <div className="absolute -right-9 -bottom-12 h-40 w-40 rounded-full border-[18px] border-paper/10" aria-hidden />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
            <StatPill label="Artistas · Sitio" value={artistStats?.totalArtists ?? 'No disponible'} />
            <StatPill label="Obras seleccionadas · Sitio" value={artworkStats?.total ?? 'No disponible'} />
            <StatPill label="Con país registrado" value={artistStats ? formatShare(artistStats.withCountry, artistStats.totalArtists) : 'No disponible'} />
            <StatPill label="Con técnica registrada" value={artworkStats ? formatShare(artworkStats.withTechnique, artworkStats.total) : 'No disponible'} />
          </div>
        </section>

        {/* The mosaic: a wide tile and a narrower one per row, sharing the
            row's height, then the attention ranking across the whole width
            for its table. Each eyebrow says what the tile is about. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <ChartFrame
            className={meterStats ? 'lg:col-span-7' : 'lg:col-span-12'}
            eyebrow="Obras recibidas"
            title="Histórico de participaciones"
            description="Incluye envíos desde Registro y participaciones directas, sin duplicarlas."
            figure={submissionHistory ? { value: formatCount(sum(submissionHistory)), label: `obras · ${lowerFirst(windows.period)}` } : undefined}
            controls={['values', 'table']}
            actions={(
              <Segmented
                label="Agrupación del histórico de obras"
                value={grouping}
                options={(['day', 'week', 'month'] as const).map((option) => ({
                  value: option,
                  label: option === 'day' ? 'Diario' : option === 'week' ? 'Semanal' : 'Mensual',
                  href: statsHref({ period: periodDays, grouping: option, browser }),
                }))}
              />
            )}
          >
            {submissionHistory
              ? <TimeSeriesChart data={submissionHistory} unit={{ one: 'obra', other: 'obras' }} label={`Obras recibidas por ${historyUnit}`} />
              : <ChartError>No pudimos cargar el histórico de obras. Recargá la página para reintentar.</ChartError>}
          </ChartFrame>

          {meterStats && (
            <ChartFrame className="lg:col-span-5" scope="current" eyebrow="Datos actuales" title="Estado de publicación" description="Obras seleccionadas que ya se ven en el sitio.">
              <Meter value={meterStats.published} total={meterStats.total} label="publicadas" remainder={{ label: 'pendientes', done: 'Todo al día' }} />
            </ChartFrame>
          )}

          <ChartFrame
            className="lg:col-span-7"
            eyebrow="Galería 3D"
            title="Actividad reciente"
            description="Visitas únicas a la galería por día. Ayuda a detectar picos después de una publicación, difusión o campaña."
            figure={galleryHistory ? { value: formatCount(sum(galleryHistory)), label: `visitas · ${lowerFirst(windows.period)}` } : undefined}
            controls={['values', 'table']}
          >
            {galleryHistory
              ? <TimeSeriesChart data={galleryHistory} unit={{ one: 'visita', other: 'visitas' }} label="Visitas únicas a la galería por día" />
              : <ChartError>No pudimos cargar el histórico. Recargá la página para reintentar.</ChartError>}
          </ChartFrame>
          <ChartFrame
            className="lg:col-span-5"
            eyebrow="Galería 3D"
            title="Embudo principal"
            description={`El camino principal para descubrir obras, en los últimos ${periodDays} días.`}
            figure={funnelMonth ? { value: formatCount(funnelMonth.get(GALLERY_HAPPY_PATH[0].name) ?? 0), label: GALLERY_HAPPY_PATH[0].label } : undefined}
            controls={['compare']}
          >
            {funnelMonth
              ? <FunnelChart
                  label={`Embudo de la galería, ${lowerFirst(windows.period)}`}
                  steps={GALLERY_HAPPY_PATH.map((step) => ({ label: step.label, value: funnelMonth.get(step.name) ?? 0, recent: funnelWeek?.get(step.name) }))}
                  base={funnelMonth.get(GALLERY_HAPPY_PATH[0].name) ?? 0}
                  note="% de quienes abrieron la galería."
                  windows={windows}
                />
              : <ChartError>No pudimos cargar el embudo.</ChartError>}
          </ChartFrame>

          <GalleryAttentionStats days={periodDays} className="lg:col-span-12" />
        </div>

        <StatsSection masonry id="linear-journeys-title" eyebrow="Recorridos lineales" title="Embudos" description="Etapas consecutivas: cada bloque muestra el avance del mismo camino.">
          <JourneySection
            {...journey}
            title="Circuito de la galería"
            description="El camino central de descubrimiento: abrir la Galería 3D, entrar a recorrerla y descubrir una obra. Cada navegador cuenta una vez, con un identificador anónimo. Se mide desde el 25 de septiembre de 2026."
            steps={GALLERY_HAPPY_PATH}
            baseStep="gallery_view"
            baseLabel="De quienes abrieron la galería"
          />

          <JourneySection
            {...journey}
            title="Invitación después de un like o comentario"
            description="Quien da like o comenta una obra en la galería (muchas veces gente que llegó porque el artista la compartió) ve ahí mismo la invitación a mandar su propia obra. Se mide desde el 28 de septiembre de 2026."
            steps={INVITE_EVENTS}
            baseStep="artist_invite_view"
            baseLabel="De quienes vieron la invitación"
          />

          <JourneySection
            {...journey}
            title="Invitaciones de los artistas"
            description="Los links que comparten los artistas llevan su invitación: quien llega por uno ve «te invita a participar» y, si se inscribe, cuenta para ese artista. Se mide desde el 28 de septiembre de 2026."
            steps={REFERRAL_EVENTS}
            baseStep="referral_open"
            baseLabel="De quienes llegaron invitados"
          />

          <JourneySection
            {...journey}
            title="Formulario de inscripción"
            description="El recorrido lineal dentro del formulario: desde verlo hasta tocar «Enviar». Se mide desde el 28 de septiembre de 2026."
            steps={ONBOARDING_FORM_EVENTS}
            baseStep="onboarding_form_view"
            baseLabel="De quienes vieron el formulario"
          />

          <JourneySection
            {...journey}
            title="Tienda"
            description="Desde abrir la tienda hasta que PayPal aprueba la suscripción, para ver en qué paso se pierde la venta. Se mide desde el 1 de octubre de 2026."
            steps={STORE_FUNNEL_EVENTS}
            baseStep="store_view"
            baseLabel="De quienes abrieron la tienda"
          />

          <JourneySection
            {...journey}
            title="Preventa de la revista"
            description="Desde abrir /revista hasta pagar con Mercado Pago. Mientras la preventa no tenga precio, la página junta mails (ver «Avisame»). Se mide desde el 1 de octubre de 2026."
            steps={MAGAZINE_FUNNEL_EVENTS}
            baseStep="magazine_view"
            baseLabel="De quienes abrieron la revista"
          />
        </StatsSection>

        <StatsSection masonry id="action-comparisons-title" tone="red" eyebrow="Acciones alternativas" title="Comparativas" description="No son pasos consecutivos: sirven para comparar qué acción genera más movimiento.">
          <JourneySection
            {...journey}
            title="Origen de las inscripciones"
            description="Cada inscripción terminada, según de dónde llegó su artista la primera vez que entró (Instagram, el link de un artista, Google, un mail…). Se mide desde el 12 de octubre de 2026."
            steps={SIGNUP_SOURCE_EVENTS}
            baseStep="signup_done"
            baseLabel="De las inscripciones terminadas"
            figureLabel="Inscripciones terminadas"
            footnote="Quien entró por primera vez antes del 12 de octubre no tiene origen guardado: la diferencia con el total son esas inscripciones. Los mails solo se reconocen cuando el link lleva ?desde=mail o utm_source."
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Ingreso con Google"
            description="Todos los botones «Ingresar con Google» del sitio: cuántos lo tocaron, cuántos volvieron con la sesión iniciada y cuántos ingresos fallaron. Se mide desde el 12 de octubre de 2026."
            steps={LOGIN_EVENTS}
            baseStep="login_google_click"
            baseLabel="De quienes tocaron «Ingresar con Google»"
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Formulario: recuperaciones y errores"
            description="Quienes volvieron al formulario y encontraron lo que habían escrito (el navegador de Instagram recarga la página al elegir la imagen) y quienes recibieron un error al enviar. «Recuperaron» se mide desde el 12 de octubre de 2026."
            steps={FORM_RESCUE_EVENTS}
            baseStep="onboarding_form_view"
            baseLabel="De quienes vieron el formulario"
            figureLabel="Vieron el formulario"
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Tiempo de carga de la galería"
            description="Cuánto tardó la Galería 3D en estar lista para caminar, desde que se abrió. Se mide desde el 12 de octubre de 2026."
            steps={GALLERY_READY_EVENTS}
            baseStep="gallery_view"
            baseLabel="De quienes abrieron la galería"
            figureLabel="Abrieron la galería"
            footnote="La diferencia entre quienes abrieron la galería y la suma de estos rangos son quienes se fueron antes de que terminara de cargar."
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Botones de la home"
            description="Personas distintas que tocaron cada botón, para comparar cuál lleva más gente a mandar su obra. Mismo identificador anónimo que el circuito de la galería. Se mide desde el 26 de septiembre de 2026."
            steps={HOME_EVENTS}
            baseStep="home_view"
            baseLabel="De quienes abrieron la home"
            footnote="«Participar» está en el encabezado de todas las páginas, así que también cuenta a quien lo tocó fuera de la home."
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Compartir obras"
            description="Acciones para difundir obras desde sus páginas, la home, la confirmación y la galería. Abrir WhatsApp o completar el menú de compartir no confirma una publicación. Las copias exitosas y las nuevas opciones de galería se miden desde el 6 de octubre de 2026; los clics originales, desde el 26 de septiembre."
            steps={SHARE_EVENTS}
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Collage colectivo"
            description="Desde abrir el cuadro de la Sala 1 (E frente a él) hasta pegar una foto. «Sin vidas» cuenta a quien intentó pegar con las tres vidas usadas. Se mide desde el 2 de octubre de 2026."
            steps={WALL_EVENTS}
            baseStep="wall_open"
            baseLabel="De quienes abrieron el collage"
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Foto souvenir de la galería"
            description="Personas distintas que sacaron una foto en la Galería 3D (botón de la cámara o tecla F) y qué hicieron con ella. Se mide desde el 2 de octubre de 2026."
            steps={SOUVENIR_EVENTS}
            baseStep="souvenir_photo"
            baseLabel="De quienes sacaron una foto"
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Descubrimiento de obras y artistas"
            description="Cómo las páginas públicas de obra y artista llevan a conocer más del proyecto o a empezar una participación."
            steps={DISCOVERY_EVENTS}
            baseStep="artwork_page_view"
            baseLabel="De quienes abrieron una obra"
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Cómo llegan a la tienda"
            description="Personas distintas que fueron a la tienda desde el encabezado, una página de obra o el mail diario «Así le fue a tu obra». Se mide desde el 1 de octubre de 2026."
            steps={STORE_ENTRY_EVENTS}
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Cómo llegan a la revista"
            description="Personas distintas que fueron a /revista desde la tienda, después de inscribirse o desde la tarjeta «Ya estás participando» de la home. Se mide desde el 1 de octubre de 2026."
            steps={MAGAZINE_ENTRY_EVENTS}
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="«Avisame» de finalistas y revista"
            description="Personas que dejaron su mail para enterarse de las finalistas y la revista, según dónde lo hicieron. Quedan en Contactos con el origen «aviso_…». Se mide desde el 1 de octubre de 2026."
            steps={WAITLIST_EVENTS}
            variant="comparison"
          />

          <JourneySection
            {...journey}
            title="Partners y marcas"
            description="Personas distintas que abrieron /partners, desde dónde llegaron y cuántas tocaron el mail para escribirnos. Se mide desde el 4 de octubre de 2026."
            steps={PARTNER_EVENTS}
            variant="comparison"
          />
        </StatsSection>

        <StatsSection
          id="site-data-title"
          eyebrow="Datos actuales del sitio"
          title="Artistas y obras"
          description="Sobre las obras seleccionadas, con imagen y sin archivar (publicadas y pendientes). Países cuenta artistas y técnicas cuenta obras. Las barras se escalan al grupo más grande; los porcentajes usan el total de cada gráfico y, por redondeo, la suma puede diferir de 100%."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartFrame
              scope="current"
              title="Artistas por país"
              description="Cada artista cuenta una vez, con el país de su perfil."
              figure={artistStats ? { value: formatCount(artistStats.totalArtists), label: 'artistas' } : undefined}
              footnote={artistStats ? `Base: ${artistStats.totalArtists} artistas. ${artistStats.totalArtists - artistStats.withCountry} sin país registrado.` : undefined}
              controls={['limit']}
            >
              {!artistStats ? <ChartError>No pudimos cargar las estadísticas actuales. Recargá la página para reintentar.</ChartError>
                : artistStats.totalArtists === 0 ? <EmptyChart>Todavía no hay artistas con una obra seleccionada.</EmptyChart>
                  : (
                    <BarList
                      label="Distribución de artistas por país"
                      rows={artistStats.countries.map(({ countryCode, count }) => ({ label: countryLabel(countryCode), value: count }))}
                      total={artistStats.totalArtists}
                      note={leadingCountry ? `${countryLabel(leadingCountry.countryCode)} reúne el ${formatShare(leadingCountry.count, artistStats.totalArtists)} de los artistas.` : undefined}
                    />
                  )}
            </ChartFrame>

            <div className="flex flex-col gap-6">
              {meterStats && (
                <ChartFrame scope="current" title="Datos de técnica" description="Qué tan completo está este dato.">
                  <Meter value={meterStats.withTechnique} total={meterStats.total} label="con técnica registrada" remainder={{ label: 'sin técnica', done: 'Todo completo' }} />
                </ChartFrame>
              )}
              <ChartFrame
                className="flex-1"
                scope="current"
                title="Obras por técnica"
                description="Incluye obras publicadas y pendientes; no incluye precargas sin una obra vinculada en el sitio."
                figure={artworkStats ? { value: formatCount(artworkStats.total), label: 'obras seleccionadas' } : undefined}
                footnote={artworkStats ? `Base: ${artworkStats.total} obras. ${artworkStats.total - artworkStats.withTechnique} sin técnica registrada. Los porcentajes incluyen los datos faltantes.` : undefined}
              >
                {!artworkStats ? <ChartError>No pudimos cargar las estadísticas actuales. Recargá la página para reintentar.</ChartError>
                  : artworkStats.total === 0 ? <EmptyChart>Todavía no hay obras seleccionadas con imagen para analizar.</EmptyChart>
                    : <BarList label="Distribución de obras por técnica" rows={artworkStats.techniques.map(({ label, count }) => ({ label, value: count }))} total={artworkStats.total} />}
              </ChartFrame>
            </div>
          </div>
        </StatsSection>
      </StatsBusyArea>
    </StatsViewProvider>
  )
}
