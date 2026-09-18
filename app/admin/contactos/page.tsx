import { UserMinus, UserPlus, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { importContacts, toggleSubscribed, deleteContact } from './actions'

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string }>
}) {
  const { error, imported } = await searchParams
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, source, subscribed, created_at')
    .order('created_at', { ascending: false })

  const list = contacts ?? []
  const subscribedCount = list.filter((c) => c.subscribed).length

  return (
    <div>
      <AdminPageHeader eyebrow="Newsletter" title="Contactos" />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Contactos totales" value={list.length} />
        <StatPill label="Suscriptos" value={subscribedCount} />
      </div>

      {imported && (
        <p className="mt-4 rounded-xl border-2 border-collage-blue/30 bg-collage-blue/10 px-4 py-3 text-sm text-ink">
          Se importaron {imported} contactos (los duplicados se ignoran).
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error === 'no_valid_emails' ? 'No encontré ningún mail válido en el texto pegado.' : error}
        </p>
      )}

      <form action={importContacts} className="mt-8 rounded-2xl border-2 border-ink/10 bg-card p-6">
        <label className="text-sm font-semibold text-ink" htmlFor="emails">
          Importar contactos
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Uno por línea. Acepta &quot;mail@ejemplo.com&quot;, &quot;mail@ejemplo.com, Nombre&quot; o
          &quot;Nombre &lt;mail@ejemplo.com&gt;&quot;.
        </p>
        <textarea
          id="emails"
          name="emails"
          required
          rows={8}
          className="mt-3 w-full rounded-xl border-2 border-ink/15 bg-background p-3 font-mono text-sm text-ink"
          placeholder={'sofia@ejemplo.com\nMateo Alviani <mateo@ejemplo.com>'}
        />
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="source">
            Origen
          </label>
          <input
            id="source"
            name="source"
            defaultValue="obra_email"
            className="rounded-lg border-2 border-ink/15 bg-background px-3 py-1.5 text-sm text-ink"
          />
        </div>
        <SubmitButton className="mt-4 gap-2" pendingLabel="Importando…">
          <Upload className="h-4 w-4" />
          Importar
        </SubmitButton>
      </form>

      <div className="mt-10 overflow-hidden rounded-2xl border-2 border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-card text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Todavía no importaste ningún contacto.
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="border-t border-ink/10">
                <td className="px-4 py-3 text-ink">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      c.subscribed
                        ? 'rounded-full bg-collage-blue/15 px-2.5 py-1 text-xs font-semibold text-collage-blue'
                        : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'
                    }
                  >
                    {c.subscribed ? 'Suscripto' : 'Dado de baja'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <form action={toggleSubscribed}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="subscribed" value={String(c.subscribed)} />
                      <SubmitButton
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        pendingLabel={c.subscribed ? 'Dando de baja…' : 'Resuscribiendo…'}
                      >
                        {c.subscribed ? (
                          <>
                            <UserMinus className="h-3.5 w-3.5" />
                            Dar de baja
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            Resuscribir
                          </>
                        )}
                      </SubmitButton>
                    </form>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={c.id} />
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
