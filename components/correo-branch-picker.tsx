'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { useI18n } from '@/lib/i18n/client'
import provinces from '@/lib/argentina-provinces.json'
import { branchDistance, CORREO_PROVINCES, searchBranches, type CorreoBranch } from '@/lib/correo-branches'
import { site } from '@/lib/site'
import { track } from '@/lib/track'

export type PickupSelection = { branch: CorreoBranch; payment: 'included' | 'monthly'; fee: number }

type Result = { province: string; branches: CorreoBranch[]; payment: PickupSelection['payment']; fee: number }
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
        {error && <div role="alert" className="space-y-2 text-sm">
          <p>{t.unavailable}</p>
          <button type="button" onClick={() => { setError(false); setRetry((n) => n + 1) }} className="min-h-11 underline">{t.retry}</button>
          <a href={`mailto:${site.email}?subject=${encodeURIComponent('Retiro en sucursal — Mundial de Collage')}`} className="ml-4 inline-flex min-h-11 items-center underline">{t.contact}</a>
        </div>}
        {available && !filtered.length && <p role="status" className="text-sm">{t.empty}</p>}
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
      {selected && available && <p role="status" className="text-sm font-semibold">{selected.name} · {plan ? (validQuote ? `${m.store.subscriptions.shipping}: ${new Intl.NumberFormat(LOCALE_INFO[locale].intl, { style: 'currency', currency: 'ARS' }).format(validQuote.fee)}${m.store.perMonth}` : t.loading) : t.included}</p>}
      {selected && quoteError && <div role="alert" className="text-sm"><p>{t.unavailable}</p><button type="button" className="min-h-11 underline" onClick={() => { setQuoteError(false); setQuoteRetry((n) => n + 1) }}>{t.retry}</button> <a href={`mailto:${site.email}`} className="underline">{t.contact}</a></div>}
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
