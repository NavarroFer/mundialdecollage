import { countryCodeToFlag, countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { JUROR_BIOS, JUROR_PROFILE_LIMITS, type JurorProfileValues } from '@/lib/juror-profile'
import { JurorPhotoField, type PrepareJurorPhotoUpload } from '@/components/juror-photo-field'

const inputClass = 'mt-1 w-full rounded-lg border-2 border-ink/15 bg-background px-3 py-2 text-sm'
const labelClass = 'text-sm font-semibold text-ink'
const hintClass = 'font-normal text-muted-foreground'

// Built once: ~250 names sorted the Spanish way, shared by every form on the page.
let countryOptions: { code: string; label: string }[] | undefined
function getCountryOptions() {
  countryOptions ??= getAllCountryCodes()
    .map((code) => ({ code, name: countryCodeToName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(({ code, name }) => ({ code, label: `${countryCodeToFlag(code)} ${name}` }))
  return countryOptions
}

// The profile fields of a juror (parseJurorProfile reads them), for the
// admin's add and edit forms and the juror's own on /jurado. A native
// <select> rather than CountrySelect: the browser's `required` check then
// catches a missing country before the form leaves, so the bios typed so far
// aren't lost to the error redirect. The photo needs the juror to exist, so
// it shows only with prepareUpload (not in the admin's add form).
export function JurorProfileFields({
  idPrefix,
  values,
  prepareUpload,
  nameRequired = false,
  showAllBios = false,
}: {
  idPrefix: string
  values?: JurorProfileValues
  prepareUpload?: PrepareJurorPhotoUpload
  nameRequired?: boolean
  // Medium and long bios open from the start, instead of behind «Más versiones».
  showAllBios?: boolean
}) {
  const [shortBio, ...longerBios] = JUROR_BIOS
  const id = (field: string) => `${idPrefix}-${field}`
  return (
    <>
      {prepareUpload && <JurorPhotoField id={id('photo')} initialPath={values?.photo_path ?? null} prepareUpload={prepareUpload} />}
      <div>
        <label htmlFor={id('name')} className={labelClass}>Nombre {!nameRequired && <span className={hintClass}>(opcional)</span>}</label>
        <input id={id('name')} name="name" required={nameRequired} defaultValue={values?.name ?? ''} maxLength={JUROR_PROFILE_LIMITS.name} autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor={id('country_code')} className={labelClass}>País</label>
        <select id={id('country_code')} name="country_code" required defaultValue={values?.country_code ?? ''} className={inputClass}>
          <option value="" disabled>Elegí un país…</option>
          {getCountryOptions().map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id('job_title')} className={labelClass}>Cargo <span className={hintClass}>· Ej.: Curadora del MALBA, artista visual, docente.</span></label>
        <input id={id('job_title')} name="job_title" required defaultValue={values?.job_title ?? ''} maxLength={JUROR_PROFILE_LIMITS.job_title} autoComplete="organization-title" className={inputClass} />
      </div>
      <BioField id={id(shortBio.field)} bio={shortBio} value={values?.[shortBio.field]} />
      {showAllBios ? (
        longerBios.map((bio) => <BioField key={bio.field} id={id(bio.field)} bio={bio} value={values?.[bio.field]} />)
      ) : (
        <details open={longerBios.some((bio) => values?.[bio.field])} className="rounded-lg border-2 border-dashed border-ink/15 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-collage-blue">Más versiones de la bio (opcional)</summary>
          <div className="mt-3 space-y-3">
            {longerBios.map((bio) => <BioField key={bio.field} id={id(bio.field)} bio={bio} value={values?.[bio.field]} />)}
          </div>
        </details>
      )}
    </>
  )
}

function BioField({ id, bio, value }: { id: string; bio: (typeof JUROR_BIOS)[number]; value?: string | null }) {
  const max = JUROR_PROFILE_LIMITS[bio.field]
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{bio.label} <span className={hintClass}>(opcional) · {bio.hint} Hasta {max} caracteres.</span></label>
      <textarea id={id} name={bio.field} rows={bio.rows} maxLength={max} defaultValue={value ?? ''} className={inputClass} />
    </div>
  )
}
