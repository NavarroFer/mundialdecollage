import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { StatBar } from '@/components/admin/stat-bar'
import stats from '@/data/artist-country-stats.json'
import { buildArtworkStats, formatShare, type StatsArtwork } from '@/lib/artwork-stats'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

async function getArtworkStats() {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const artworks: StatsArtwork[] = []
  // Paginate to avoid silently truncating the report at Supabase's row limit.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('artworks')
      .select('technique, profiles!inner(is_public)')
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
  return buildArtworkStats(artworks)
}

export default async function EstadisticasPage() {
  const artworkStats = await getArtworkStats()
  const missingCountry = stats.countries.find(c => c.country === 'Sin país registrado')?.count ?? 0
  const leadingCountry = stats.countries[0]

  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        De dónde vienen los artistas, qué técnicas eligen y cómo avanza la publicación.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill label="Artistas · Registro" value={stats.totalArtists} />
        <StatPill label="Con país registrado" value={formatShare(stats.totalArtists - missingCountry, stats.totalArtists)} />
        <StatPill label="Obras seleccionadas · Sitio" value={artworkStats?.total ?? 'No disponible'} />
        <StatPill label="Con técnica registrada · Sitio" value={artworkStats ? formatShare(artworkStats.withTechnique, artworkStats.total) : 'No disponible'} />
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border-2 border-ink/10 bg-card p-5 sm:p-6">
          <h2 className="font-display text-xl tracking-tight text-ink uppercase">Artistas por país</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Porcentaje sobre {stats.totalArtists} artistas del corte de Registro. Cada artista cuenta una vez por email.
          </p>
          {leadingCountry && (
            <p className="mt-4 rounded-xl bg-collage-blue/10 p-3 text-sm text-ink">
              <strong>{leadingCountry.country}</strong> reúne el {formatShare(leadingCountry.count, stats.totalArtists)} de los artistas.
            </p>
          )}
          <ul className="mt-6 space-y-4" aria-label="Distribución de artistas por país">
            {stats.countries.map(({ country, count }) => (
              <li key={country}>
                <StatBar label={country} value={count} maxValue={leadingCountry?.count ?? 0} total={stats.totalArtists} color="var(--color-collage-blue)" />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Fuente: <a href={stats.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{stats.sheet}</a>,
            con países del corte curado «{stats.countrySource}». Solo artistas que siguen en Registro.
            «Canadá / Venezuela» cuenta como un artista. Este corte no se actualiza en vivo.
          </p>
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
            Países y técnicas usan bases distintas: artistas del corte de Registro y obras actuales del sitio.
            Las barras de país y técnica se escalan al grupo más grande; los porcentajes usan el total de cada sección.
            Por redondeo, la suma puede diferir de 100%.
          </p>
        </div>
      </div>
    </div>
  )
}
