import { KpiCard, KpiStrip } from '@/components/admin/stats/kpi-card'
import type { CommunityStats } from '@/lib/community-stats'

// The targets from docs/red-social.md §11.1. They are the bar to read the
// live numbers against, not numbers about the site.
const GOALS = { posted: 0.2, offer: 0.3, response: 0.5, second: 0.25, strip: 0.08 }

function pct(part: number, whole: number): string {
  if (!whole) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

const KIND: Record<string, string> = { artwork: 'Obra', souvenir: 'Souvenir', photo: 'Foto' }

export function CommunityStatsPanel({
  stats,
  homeViews,
  stripViews,
  offerViews,
  published,
}: {
  stats: CommunityStats | null
  homeViews: number
  stripViews: number
  offerViews: number
  published: number
}) {
  if (!stats) return <p className="text-sm text-muted-foreground">No pudimos leer Comunidad. Recargá la página.</p>
  return (
    <div className="flex flex-col gap-6">
      <KpiStrip label="Comunidad">
        <KpiCard highlight label="Artistas activos en 7 días" value={String(stats.activeWeek)} context="Publicaron, comentaron o dieron me gusta" recent="Indicador principal" />
        <KpiCard label="Inscriptos que publicaron" value={pct(stats.postedArtists, stats.artists)} context={`${stats.postedArtists} de ${stats.artists} artistas públicos`} recent={`Meta 30 días: ${Math.round(GOALS.posted * 100)}%`} />
        <KpiCard label="Conversión de la oferta" value={pct(published, offerViews)} context={`${published} publicaron / ${offerViews} vieron la oferta`} recent={`Meta: ${Math.round(GOALS.offer * 100)}%`} />
        <KpiCard label="Con al menos una respuesta" value={pct(stats.withResponse, stats.posts)} context={`${stats.withResponse} de ${stats.posts} publicaciones`} recent={`Meta: ${Math.round(GOALS.response * 100)}%`} />
      </KpiStrip>
      <KpiStrip label="Más de Comunidad">
        <KpiCard label="Publican por segunda vez" value={pct(stats.repeatArtists, stats.postedArtists)} context={`${stats.repeatArtists} de quienes publicaron`} recent={`Meta: ${Math.round(GOALS.second * 100)}%`} />
        <KpiCard label="Clics en la franja" value={pct(stripViews, homeViews)} context={`${stripViews} vieron la franja / ${homeViews} abrieron el inicio`} recent={`Meta: ${Math.round(GOALS.strip * 100)}% de home_view`} />
        <KpiCard label="Me gusta por publicación" value={stats.avgLikes.toFixed(1)} context="Promedio en las publicadas" />
        <KpiCard label="Comentarios por publicación" value={stats.avgComments.toFixed(1)} context="Promedio en las publicadas" />
      </KpiStrip>
      <p className="text-sm text-muted-foreground">
        Por tipo: {stats.byKind.length ? stats.byKind.map((row) => `${KIND[row.kind] ?? row.kind} ${row.count}`).join(' · ') : 'todavía no hay publicaciones'}.
      </p>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Pendiente: artistas que vuelven a los 7 días (no hay un dato de retorno armado) y las inscripciones que llegan por el link de una publicación. Ese link usa el mismo ?ref= que la obra, así que hoy no se distinguen de las que llegan por compartir la obra.
      </p>
    </div>
  )
}
