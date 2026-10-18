'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { useI18n } from '@/lib/i18n/client'
import provinces from '@/lib/argentina-provinces.json'
import { branchDistance, CORREO_PROVINCES, searchBranches, type CorreoBranch } from '@/lib/correo-branches'
import { site } from '@/lib/site'
import { planById, storePlanName } from '@/lib/store'
import { track } from '@/lib/track'

export type PickupSelection = { branch: CorreoBranch; payment: 'included' | 'monthly'; fee: number }

// When the branches won't load, or none fits: the address goes to us by
// email (the visitor's own mail app, nothing sent from here) so the sale
// isn't lost while the Correo lookup is down.
function ManualAddress({ plan, province }: { plan?: string; province: string }) {
  const { m } = useI18n()
  const t = m.store.pickup
  const id = useId()
  const [address, setAddress] = useState('')
  const storePlan = plan ? planById(plan) : null
  const planName = storePlan ? storePlanName(storePlan, m.store) : ''
  const subject = t.manualSubject.replace('{plan}', planName).trim()
  const body = [planName, province, address.trim()].filter(Boolean).join('\n')
  return (
    <div className="space-y-2 rounded-lg border-2 border-collage-blue/25 bg-collage-blue/5 p-3 text-sm">
      <p className="font-semibold">{t.manualTitle}</p>
      <label htmlFor={`${id}-address`} className="block text-sm font-medium">{t.manualLabel}</label>
      <textarea id={`${id}-address`} value={address} onChange={(event) => setAddress(event.target.value)} rows={2} maxLength={300} autoComplete="street-address" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <a
        href={`mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        aria-disabled={!address.trim()}
        onClick={(event) => { if (!address.trim()) event.preventDefault() }}
        className="inline-flex min-h-11 items-center rounded-full bg-collage-blue px-4 font-semibold text-primary-foreground aria-disabled:opacity-50"
      >
        {t.manualSend}
      </a>
      <p className="text-xs text-muted-foreground">{t.manualHelp}</p>
    </div>
  )
}

type Result = { province: string; branches: CorreoBranch[]; payment: PickupSelection['payment']; fee: number }
export type AddressForBranch = { address: string; city: string; province: string; fee: number }

const AR_POSTAL = /^([a-z]\d{4}[a-z]{3}|\d{4})$/i

// While Correo Argentino's API credentials aren't set (lib/correo.ts) no
// branch can be listed: the buyer gives their address and we choose the
// nearest branch by hand before shipping, at the flat tariff. Same field
// names as the branch picker's hidden ones, so the server action reads both.
export function AddressForBranchFields({ fee, initial, onChange }: {
  fee: number
  initial: Partial<Record<'province' | 'city' | 'postal_code' | 'address_line_1' | 'address_line_2', string>>
  onChange: (delivery: AddressForBranch | null) => void
}) {
  const { m } = useI18n()
  const t = m.store.pickup
  const labels = m.store.mp
  const id = useId()
  const [values, setValues] = useState({
    province: initial.province ?? '', city: initial.city ?? '', postal_code: initial.postal_code ?? '',
    address_line_1: initial.address_line_1 ?? '', address_line_2: initial.address_line_2 ?? '',
  })
  const complete = values.province && values.city.trim().length >= 2 && values.address_line_1.trim().length >= 3 && AR_POSTAL.test(values.postal_code.replace(/\s/g, ''))
  useEffect(() => {
    onChange(complete ? { address: values.address_line_1.trim(), city: values.city.trim(), province: values.province, fee } : null)
  }, [complete, values, fee, onChange])
  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((current) => ({ ...current, [field]: event.target.value }))
  const input = 'mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  return (
    <fieldset className="space-y-3 rounded-xl border-2 border-ink/15 bg-background p-4 text-left">
      <legend className="px-1 text-base font-semibold">{t.addressTitle}</legend>
      <p className="text-sm">{t.addressHelp}</p>
      <label className="block text-sm font-medium" htmlFor={`${id}-province`}>{labels.province}</label>
      <select id={`${id}-province`} name="province" required value={values.province} onChange={set('province')} className={input}>
        <option value="">{labels.province}…</option>
        {provinces.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      <label className="block text-sm font-medium">{labels.city}<input name="city" required autoComplete="address-level2" maxLength={100} value={values.city} onChange={set('city')} className={input} /></label>
      <label className="block text-sm font-medium">{labels.address}<input name="address_line_1" required autoComplete="address-line1" maxLength={200} value={values.address_line_1} onChange={set('address_line_1')} className={input} /></label>
      <label className="block text-sm font-medium">{labels.apartment}<input name="address_line_2" autoComplete="address-line2" maxLength={100} value={values.address_line_2} onChange={set('address_line_2')} className={input} /></label>
      <label className="block text-sm font-medium">{labels.postalCode}<input name="postal_code" required autoComplete="postal-code" inputMode="text" maxLength={10} value={values.postal_code} onChange={set('postal_code')} className={input} /></label>
      <input type="hidden" name="branch_code" value="" />
      <input type="hidden" name="shipping_fee" value={fee} />
    </fieldset>
  )
}

export function CorreoBranchPicker({ plan, initialProvince = '', initialCode = '', onChange }: {
  plan?: string
  initialProvince?: string
  initialCode?: string
  onChange: (selection: PickupSelection | null) => void
}) {
  const { m, locale } = useI18n()
  const t = m.store.pickup
  const id = useId()
  const [province, setProvince] = useState(initialProvince)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [quote, setQuote] = useState<{ code: string; province: string; plan: string; fee: number } | null>(null)
  const [quoteError, setQuoteError] = useState(false)
  const [quoteRetry, setQuoteRetry] = useState(0)
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [limit, setLimit] = useState(5)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState(false)
  const [locating, setLocating] = useState(false)
  const provinceCode = CORREO_PROVINCES[provinces.find((p) => p.name === province)?.id ?? '']
  useEffect(() => {
    if (!provinceCode) return
    const controller = new AbortController()
    const params = new URLSearchParams({ province: provinceCode, ...(plan ? { plan } : {}) })
    void fetch(`/api/shipping/branches?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        if (!Array.isArray(data.branches) || data.payment !== 'included' || !Number.isFinite(data.fee)) throw new Error('Invalid response')
        setResult({ ...data, province: provinceCode })
        setError(false)
      })
      .catch(() => { if (!controller.signal.aborted) { setError(true); track('shipping_search_failed') } })
    return () => controller.abort()
  }, [provinceCode, plan, retry])
  const available = result?.province === provinceCode ? result : null
  const selected = available?.branches.find((branch) => branch.code === code)
  const validQuote = quote?.code === code && quote?.province === provinceCode && quote?.plan === plan ? quote : null
  useEffect(() => {
    if (!plan || !selected || !provinceCode) return
    const controller = new AbortController()
    const params = new URLSearchParams({ plan, province: provinceCode, branch: selected.code })
    void fetch(`/api/shipping/quote?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        if (!Number.isFinite(data.fee) || data.fee <= 0) throw new Error('Invalid quote')
        setQuote({ plan, code: selected.code, province: provinceCode, fee: data.fee }); setQuoteError(false)
      }).catch(() => { if (!controller.signal.aborted) { setQuoteError(true); track('shipping_search_failed') } })
    return () => controller.abort()
  }, [plan, selected, provinceCode, quoteRetry])
  useEffect(() => {
    onChange(selected && available && (!plan || validQuote) ? { branch: selected, payment: plan ? 'monthly' : 'included', fee: validQuote?.fee ?? 0 } : null)
  }, [selected, available, plan, validQuote, onChange])
  const filtered = useMemo(() => {
    const matches = searchBranches(available?.branches ?? [], query)
    return matches.sort((a, b) => {
      if (location) {
        const delta = (branchDistance(a, location) ?? Infinity) - (branchDistance(b, location) ?? Infinity)
        if (delta && Number.isFinite(delta)) return delta
        if (branchDistance(a, location) !== null && branchDistance(b, location) === null) return -1
        if (branchDistance(a, location) === null && branchDistance(b, location) !== null) return 1
      }
      return a.name.localeCompare(b.name, locale)
    })
  }, [available, query, location, locale])
  useEffect(() => {
    if (!available || filtered.length || !query.trim()) return
    const timer = setTimeout(() => track('shipping_search_empty'), 1500)
    return () => clearTimeout(timer)
  }, [available, filtered.length, query])
  const changeProvince = (value: string) => { setProvince(value); setCode(''); setQuote(null); setQuoteError(false); setQuery(''); setResult(null); setError(false); setLimit(5); onChange(null) }
  const useLocation = () => {
    setLocationError(false)
    if (!navigator.geolocation) { setLocationError(true); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocating(false)
    }, () => { setLocationError(true); setLocating(false) }, { timeout: 10000, maximumAge: 60000 })
  }
  return (
    <fieldset className="space-y-4 rounded-xl border-2 border-ink/15 bg-background p-4 text-left">
      <legend className="px-1 text-base font-semibold">{t.title}</legend>
      <p className="text-sm">{t.mode}</p>
      <label htmlFor={`${id}-province`} className="block text-sm font-medium">{t.province}</label>
      <select id={`${id}-province`} value={province} onChange={(e) => changeProvince(e.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="">{t.province}…</option>
        {provinces.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      {provinceCode && <>
        <label htmlFor={`${id}-search`} className="block text-sm font-medium">{t.search}</label>
        <input id={`${id}-search`} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(5) }} maxLength={100} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" aria-describedby={`${id}-help`} />
        <p id={`${id}-help`} className="text-xs text-muted-foreground">{t.searchHelp}</p>
        <button type="button" disabled={locating} onClick={useLocation} className="min-h-11 text-sm underline disabled:opacity-50">{t.location}</button>
        {locationError && <p role="status" className="text-sm">{t.locationError}</p>}
        {!available && !error && <p role="status" className="text-sm">{t.loading}</p>}
        {error && <div className="space-y-2 text-sm">
          <p role="alert" className="font-semibold text-collage-red">{t.unavailable}</p>
          <button type="button" onClick={() => { setError(false); setRetry((n) => n + 1) }} className="min-h-11 underline">{t.retry}</button>
          <ManualAddress plan={plan} province={province} />
        </div>}
        {available && !filtered.length && <>
          <p role="status" className="text-sm">{t.empty}</p>
          <ManualAddress plan={plan} province={province} />
        </>}
        <div role="radiogroup" aria-label={t.title} className="space-y-3">
          {filtered.slice(0, limit).map((branch) => {
            const distance = location && branchDistance(branch, location)
            const schedules = branch.hours ? branch.hours.split('|').map((entry) => { const separator = entry.indexOf(':'); return `${t.days.split(',')[Number(entry.slice(0, separator))]} ${entry.slice(separator + 1)}` }).join(' · ') : t.noSchedules
            const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.address}, ${branch.locality || branch.city}, ${branch.province}, Argentina`)}`
            return <div key={branch.code} className={`rounded-lg border p-3 ${code === branch.code ? 'border-collage-blue bg-collage-blue/5' : 'border-input'}`}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="radio" name={`${id}-branch`} checked={code === branch.code} onChange={() => { setCode(branch.code); setQuote(null); setQuoteError(false); onChange(null); track('shipping_branch_selected') }} className="mt-1 size-4" />
                <span className="space-y-1 text-sm">
                  <span className="block font-semibold">{branch.name}</span>
                  <span className="block">{branch.address} · {branch.locality || branch.city}</span>
                  <span className="block text-xs text-muted-foreground">{t.schedules}: {schedules}</span>
                  {distance !== null && <span className="block text-xs">{new Intl.NumberFormat(LOCALE_INFO[locale].intl, { maximumFractionDigits: 1 }).format(distance)} {t.distance}</span>}
                  <span className="block text-xs font-semibold">{code === branch.code ? t.selected : t.choose}</span>
                </span>
              </label>
              <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs underline">{t.map}</a>
            </div>
          })}
        </div>
        {filtered.length > limit && <button type="button" onClick={() => setLimit((n) => n + 10)} className="min-h-11 text-sm underline">{t.more}</button>}
      </>}
      {selected && available && <p role="status" className="text-sm font-semibold">{selected.name} · {plan ? (validQuote ? m.store.freeShipping : t.loading) : t.included}</p>}
      {selected && quoteError && <div className="space-y-2 text-sm"><p role="alert" className="font-semibold text-collage-red">{t.unavailable}</p><button type="button" className="min-h-11 underline" onClick={() => { setQuoteError(false); setQuoteRetry((n) => n + 1) }}>{t.retry}</button><ManualAddress plan={plan} province={province} /></div>}
      <input type="hidden" name="branch_code" value={selected?.code ?? ''} />
      <input type="hidden" name="province" value={province} />
      <input type="hidden" name="city" value={selected?.locality || selected?.city || ''} />
      <input type="hidden" name="postal_code" value={selected?.postalCode ?? ''} />
      <input type="hidden" name="address_line_1" value={selected?.address ?? ''} />
      <input type="hidden" name="address_line_2" value="" />
      <input type="hidden" name="shipping_fee" value={plan ? validQuote?.fee ?? '' : 0} />
    </fieldset>
  )
}
