'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountrySelect } from '@/components/ui/country-select'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { confirmArtistDetails } from './actions'

const countries = getAllCountryCodes().map(code => ({ code, name: countryCodeToName(code) })).sort((a, b) => a.name.localeCompare(b.name))

export function ArtistConfirmation({ name, countryCode, email, artwork }: {
  name: string
  countryCode: string
  email: string
  artwork: { id: string; title: string; image_url: string }
}) {
  const [editedName, setEditedName] = useState(name)
  const [editing, setEditing] = useState(!name || !countryCode)
  const [error, action, pending] = useActionState(confirmArtistDetails, '')

  return (
    <form action={action} className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card shadow-sm">
      <input type="hidden" name="artwork_id" value={artwork.id} />
      <div className="relative aspect-[4/3] bg-paper">
        <Image src={artwork.image_url} alt={artwork.title} fill sizes="(max-width: 640px) 100vw, 512px" className="object-contain p-4" priority />
      </div>
      <div className="space-y-6 p-6 sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-collage-blue"><CheckCircle2 className="size-4" aria-hidden="true" />Ya tenemos tu obra</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">{artwork.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">No hace falta que vuelvas a subirla.</p>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Tus datos</h3>
          {editing ? (
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="artist-name" className="text-sm font-medium">Nombre artístico o nombre completo</label>
                <input id="artist-name" name="name" value={editedName} onChange={event => setEditedName(event.target.value)} required className="mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5" />
              </div>
              <div>
                <label htmlFor="artist-country" className="text-sm font-medium">País</label>
                <CountrySelect id="artist-country" name="country_code" countries={countries} defaultValue={countryCode} required />
                {!countryCode && <p className="mt-2 text-sm text-muted-foreground">Solo nos falta tu país para ubicarte en el mapa del Mundial.</p>}
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="country_code" value={countryCode} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Nombre</dt><dd className="break-words font-medium">{name}</dd>
                <dt className="text-muted-foreground">País</dt><dd className="font-medium">{countryCodeToName(countryCode)}</dd>
              </dl>
              <button type="button" onClick={() => setEditing(true)} className="mt-2 min-h-11 text-sm font-semibold text-collage-blue underline underline-offset-4">Corregir mis datos</button>
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">Email de tu cuenta Google</p>
          <p className="break-all text-sm font-medium">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Usamos este email para reconocer tu envío. No se muestra en tu ficha pública.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red">{error}</p>}
        <Button type="submit" size="lg" disabled={pending} className="h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-center">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? 'Confirmando…' : 'Confirmar mis datos y mi obra'}
        </Button>
        <div className="border-t border-ink/10 pt-4 text-sm text-muted-foreground">
          <p>¿Esta no es la obra que querés presentar?</p>
          <Link href="/onboarding?another=1" className="inline-flex min-h-11 items-center font-semibold text-collage-blue underline underline-offset-4">Enviar otra obra</Link>
          <div className="flex flex-wrap items-center justify-between gap-2"><span>¿Ingresaste con otra cuenta?</span><SignOutButton /></div>
        </div>
      </div>
    </form>
  )
}
