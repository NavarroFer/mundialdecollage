'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'

type Country = { code: string; name: string }

export function CountrySelect({
  id,
  name,
  countries,
  defaultValue = '',
  required,
  placeholder,
}: {
  id?: string
  name: string
  countries: Country[]
  defaultValue?: string
  required?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const { m } = useI18n()
  const [query, setQuery] = useState('')
  const [value, setValue] = useState(defaultValue)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter((c) => c.name.toLowerCase().includes(q))
  }, [countries, query])

  const selected = countries.find((c) => c.code === value)

  function select(code: string) {
    setValue(code)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex w-full items-center justify-between rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-left text-sm outline-none focus:border-collage-blue"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-base">
              {countryCodeToFlag(selected.code)}
            </span>
            {selected.name}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder ?? m.countrySelect.placeholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border-2 border-ink/15 bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b-2 border-ink/10 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.countrySelect.search}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">{m.countrySelect.notFound}</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === value}
                  onClick={() => select(c.code)}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted',
                    c.code === value && 'bg-collage-blue/10 font-semibold text-collage-blue',
                  )}
                >
                  <span aria-hidden className="text-base">
                    {countryCodeToFlag(c.code)}
                  </span>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
