import { countryCodeToFlag, countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { JUROR_BIOS, JUROR_PROFILE_LIMITS, type JurorBioField } from '@/lib/juror-profile'

type Values = { name: string | null; country_code: string | null; job_title: string | null } & Record<JurorBioField, string | null>

const inputClass = 'w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'

// Built once: ~250 names sorted the Spanish way, shared by every form on the page.
let countryOptions: { code: string; label: string }[] | undefined
function getCountryOptions() {
  countryOptions ??= getAllCountryCodes()
    .map((code) => ({ code, name: countryCodeToName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(({ code, name }) => ({ code, label: `${countryCodeToFlag(code)} ${name}` }))
  return countryOptions
}

// The profile half of the add and edit forms (parseJurorProfile reads it).
// A native <select> rather than CountrySelect: the browser's `required`
// check then catches a missing country before the form leaves, so the bios
// typed so far aren't lost to the error redirect.
export function JurorProfileFields({ idPrefix, values }: { idPrefix: string; values?: Values }) {
  const [shortBio, ...longerBios] = JUROR_BIOS
  return (
    <>
      <input name="name" defaultValue={values?.name ?? ''} placeholder="Nombre (opcional)" maxLength={JUROR_PROFILE_LIMITS.name} aria-label="Nombre" className={inputClass} />
      <select name="country_code" required defaultValue={values?.country_code ?? ''} aria-label="País" className={inputClass}>
        <option value="" disabled>País…</option>
        {getCountryOptions().map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
      </select>
      <input name="job_title" required defaultValue={values?.job_title ?? ''} placeholder="Cargo (ej.: Curadora del MALBA)" maxLength={JUROR_PROFILE_LIMITS.job_title} aria-label="Cargo" className={inputClass} />
      <BioField idPrefix={idPrefix} bio={shortBio} value={values?.[shortBio.field]} />
      <details open={longerBios.some((bio) => values?.[bio.field])} className="rounded-lg border-2 border-dashed border-ink/15 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-collage-blue">Más versiones de la bio (opcional)</summary>
        <div className="mt-3 space-y-3">
          {longerBios.map((bio) => <BioField key={bio.field} idPrefix={idPrefix} bio={bio} value={values?.[bio.field]} />)}
        </div>
      </details>
    </>
  )
}

function BioField({ idPrefix, bio, value }: { idPrefix: string; bio: (typeof JUROR_BIOS)[number]; value?: string | null }) {
  const id = `${idPrefix}-${bio.field}`
  const max = JUROR_PROFILE_LIMITS[bio.field]
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{bio.label} <span className="font-normal text-muted-foreground">· {bio.hint} Hasta {max} caracteres.</span></label>
      <textarea id={id} name={bio.field} rows={bio.rows} maxLength={max} defaultValue={value ?? ''} className={`mt-1 ${inputClass}`} />
    </div>
  )
}
