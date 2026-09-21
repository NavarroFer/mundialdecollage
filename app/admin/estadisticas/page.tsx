import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import stats from '@/data/artist-country-stats.json'

export default function EstadisticasPage() {
  return (
    <div>
      <AdminPageHeader eyebrow="Convocatoria" title="Estadísticas" />
      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Artistas · Registro" value={stats.totalArtists} />
      </div>
      <section className="mt-10 max-w-2xl">
        <h2 className="font-display text-xl tracking-tight text-ink uppercase">Artistas por país</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Corte de la hoja{' '}
          <a href={stats.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {stats.sheet}
          </a>
          . Cada artista cuenta una vez por email, aunque haya enviado varias obras. El país se toma del
          corte curado «21/9» y sólo se cuentan artistas que siguen en Registro.
        </p>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink/20">
              <th scope="col" className="py-3 text-left">País</th>
              <th scope="col" className="py-3 text-right">Artistas</th>
            </tr>
          </thead>
          <tbody>
            {stats.countries.map(({ country, count }) => (
              <tr key={country} className="border-b border-ink/10">
                <th scope="row" className="py-3 text-left font-normal">{country}</th>
                <td className="py-3 text-right tabular-nums">{count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-4 text-left">Total de artistas</th>
              <td className="py-4 text-right font-semibold tabular-nums">{stats.totalArtists}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 text-sm text-muted-foreground">
          «Canadá / Venezuela» conserva la declaración de la hoja y cuenta como un solo artista.
        </p>
      </section>
    </div>
  )
}
