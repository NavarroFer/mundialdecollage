import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { StatBar } from '@/components/admin/stat-bar'
import { buildArtistCountryStats, buildArtworkStats, formatShare, type StatsArtwork } from '@/lib/artwork-stats'
import { countryCodeToName } from '@/lib/participants'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { FUNNEL_STEPS, HOME_EVENTS, INVITE_EVENTS, ONBOARDING_EVENTS, REFERRAL_EVENTS, SHARE_EVENTS } from '@/lib/funnel'

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
      .not('title', 'is', null)
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

// Distinct visitors per circuit step (lib/funnel.ts) since `days` ago.
async function getFunnel(days: number): Promise<FunnelCounts | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('funnel_summary', { since })
  if (error) return null
  return new Map(((data ?? []) as { name: string; visitors: number | string }[]).map((row) => [row.name, Number(row.visitors)]))
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
  // Without a base step the share column is left out.
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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="py-2 pr-4 font-semibold">Paso</th>
                <th className="py-2 pr-4 text-right font-semibold">7 días</th>
                <th className="py-2 pr-4 text-right font-semibold">30 días</th>
                {baseStep && <th className="py-2 text-right font-semibold">{baseLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => {
                const monthCount = month.get(step.name) ?? 0
                return (
                  <tr key={step.name} className="border-t border-ink/10">
                    <td className="py-2 pr-4 text-ink">{step.label}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{week.get(step.name) ?? 0}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{monthCount}</td>
                    {baseStep && (
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {base ? formatShare(monthCount, base) : '—'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {footnote && <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>}
        </div>
      )}
    </section>
  )
}

export default async function EstadisticasPage() {
  const [siteStats, funnelWeek, funnelMonth] = await Promise.all([getArtworkStats(), getFunnel(7), getFunnel(30)])
  const artworkStats = siteStats?.artworks
  const artistStats = siteStats?.artists
  const leadingCountry = artistStats?.countries.find((c) => c.countryCode !== null)
  const countryLabel = (code: string | null) => (code ? countryCodeToName(code) : 'Sin país registrado')

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        De dónde vienen los artistas, qué técnicas eligen, cómo avanza la publicación y cómo se mueve la gente por la galería.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="Artistas · Sitio" value={artistStats?.totalArtists ?? 'No disponible'} />
        <StatPill label="Con país registrado · Sitio" value={artistStats ? formatShare(artistStats.withCountry, artistStats.totalArtists) : 'No disponible'} />
        <StatPill label="Obras seleccionadas · Sitio" value={artworkStats?.total ?? 'No disponible'} />
        <StatPill label="Con técnica registrada · Sitio" value={artworkStats ? formatShare(artworkStats.withTechnique, artworkStats.total) : 'No disponible'} />
      </div>

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
          <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl tracking-tight text-ink uppercase">Obras por técnica</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Datos actuales del sitio: obras seleccionadas, con título e imagen, sin archivar.
              Incluye obras publicadas y pendientes; no incluye precargas sin una obra vinculada en el sitio.
            </p>
            {!artworkStats ? (
              <p role="status" className="mt-6 text-sm text-collage-red">No pudimos cargar las estadísticas actuales. Recargá la página para reintentar.</p>
            ) : artworkStats.total === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Todavía no hay obras seleccionadas con título e imagen para analizar.</p>
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
              <ul className="mt-6 space-y-5" aria-label="Estado de publicación de las obras">
                <li><StatBar label="Publicadas" value={artworkStats.published} maxValue={artworkStats.total} total={artworkStats.total} color="var(--color-collage-blue)" /></li>
                <li><StatBar label="Pendientes de publicar" value={artworkStats.pending} maxValue={artworkStats.total} total={artworkStats.total} color="var(--color-collage-red)" /></li>
              </ul>
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
