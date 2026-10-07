'use client'

import { useEffect, useId, useState } from 'react'
import provinces from '@/lib/argentina-provinces.json'
import { cn } from '@/lib/utils'

// Suggestions are served locally from the official GeoRef catalogue. Users can
// still type a locality absent from the catalogue or use browser autofill.
export function ShippingLocationFields({ country = 'AR', labels, names = { province: 'province', city: 'city', postal: 'postal_code' }, values = {}, invalid = [], onChange, provinceRequired = true, postalRequired = true }: {
  country?: string
  labels: { province: string; city: string; postal: string }
  names?: { province: string; city: string; postal: string }
  values?: { province?: string; city?: string; postal?: string }
  invalid?: string[]
  onChange?: (field: 'province' | 'city' | 'postal', value: string) => void
  provinceRequired?: boolean
  postalRequired?: boolean
}) {
  const id = useId()
  const [province, setProvince] = useState(values.province ?? '')
  const [cities, setCities] = useState<{ province: string; names: string[] } | null>(null)
  const selected = provinces.find((item) => item.name === province)
  useEffect(() => {
    if (country !== 'AR' || !selected) return
    const controller = new AbortController()
    void fetch(`/data/argentina/${selected.id}.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((names: string[]) => setCities({ province: selected.id, names }))
      .catch(() => { /* Manual entry remains available when suggestions fail. */ })
    return () => controller.abort()
  }, [country, selected])
  const style = (name: string) => cn('mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground', invalid.includes(name) ? 'border-collage-red' : 'border-input')
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-xs font-medium">{labels.province}
        {country === 'AR' ? <select name={names.province} required={provinceRequired} autoComplete="shipping address-level1" value={province} onChange={(event) => { setProvince(event.target.value); onChange?.('province', event.target.value) }} aria-invalid={invalid.includes(names.province) || undefined} className={style(names.province)}>
          <option value="">{labels.province}…</option>
          {province && !selected && <option value={province}>{province}</option>}
          {provinces.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select> : <input name={names.province} required={provinceRequired} autoComplete="shipping address-level1" defaultValue={values.province} maxLength={100} onChange={(event) => onChange?.('province', event.target.value)} aria-invalid={invalid.includes(names.province) || undefined} className={style(names.province)} />}
      </label>
      <label className="block text-xs font-medium">{labels.city}
        <input name={names.city} required autoComplete="shipping address-level2" defaultValue={values.city} list={country === 'AR' ? `${id}-cities` : undefined} maxLength={100} onChange={(event) => onChange?.('city', event.target.value)} aria-invalid={invalid.includes(names.city) || undefined} className={style(names.city)} />
        {country === 'AR' && <datalist id={`${id}-cities`}>{cities?.province === selected?.id && cities?.names.map((city) => <option key={city} value={city} />)}</datalist>}
      </label>
      <label className="block text-xs font-medium">{labels.postal}
        <input name={names.postal} required={postalRequired} autoComplete="shipping postal-code" defaultValue={values.postal} maxLength={country === 'AR' ? 10 : 60} onChange={(event) => onChange?.('postal', event.target.value)} aria-invalid={invalid.includes(names.postal) || undefined} className={style(names.postal)} />
      </label>
    </div>
  )
}
