import { UserMinus, UserPlus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader, StatPill } from '@/components/admin/page-header'
import { SubmitButton } from '@/components/admin/submit-button'
import { toggleSubscribed, deleteContact } from './actions'
import { adminDescription } from '@/components/admin/admin-sections'

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, source, subscribed, created_at')
    .order('created_at', { ascending: false })

  const list = contacts ?? []
  const subscribedCount = list.filter((c) => c.subscribed).length

  return (
    <div>
      <AdminPageHeader eyebrow="Newsletter" title="Contactos" description={adminDescription('/admin/contactos')} />

      <div className="mt-6 flex flex-wrap gap-3">
        <StatPill label="Contactos totales" value={list.length} />
        <StatPill label="Suscriptos" value={subscribedCount} />
      </div>

      {error && (
        <p className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/10 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10">
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
                  Todavía no hay contactos.
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
