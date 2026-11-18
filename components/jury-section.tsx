import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'
import { getPublicJury } from '@/lib/jury-public'
import { jurorPhotoUrl } from '@/lib/juror-profile'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'

// «Próximamente» until the organizers publish the jury from /admin/jurado;
// from then on, the people themselves (lib/jury-public.ts). Same section and
// anchor either way, so every link to #jurado keeps working.
export async function JurySection() {
  const [{ locale, m }, jurors] = await Promise.all([getI18n(), getPublicJury()])
  const published = jurors.length > 0
  return (
    <section id="jurado" className="scroll-mt-28 bg-grain border-t-2 border-ink/10 bg-collage-blue py-14 text-primary-foreground sm:py-18">
      <div className={`mx-auto px-5 sm:px-8 ${published ? 'max-w-5xl' : 'max-w-3xl text-center'}`}>
        <FadeIn className={published ? 'text-center' : undefined}>
          <Sparkles className="mx-auto size-8 text-collage-yellow" strokeWidth={1.5} aria-hidden="true" />
          <h2 className="font-display mt-5 text-3xl leading-[1.05] tracking-tight uppercase sm:text-4xl">
            {published ? m.jury.publishedTitle1 : m.jury.title1}
            <span className="block text-collage-yellow">{published ? m.jury.publishedTitle2 : m.jury.title2}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-primary-foreground/75">
            {published ? m.jury.publishedBody : m.jury.body}
          </p>
        </FadeIn>
        {published && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jurors.map((juror) => (
              <li key={juror.id} className="flex flex-col rounded-2xl bg-paper p-5 text-ink">
                <div className="flex items-center gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-ink/10 bg-muted">
                    {juror.photoPath
                      ? <Image src={jurorPhotoUrl(juror.photoPath)} alt="" fill sizes="80px" className="object-cover" />
                      : <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-2xl text-muted-foreground">{juror.name.charAt(0)}</span>}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl leading-tight tracking-tight uppercase text-balance">{juror.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span aria-hidden>{countryCodeToFlag(juror.countryCode)} </span>{countryCodeToName(juror.countryCode, locale)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold">{juror.jobTitle}</p>
                {juror.bioShort && <p className="mt-2 text-sm text-ink/80">{juror.bioShort}</p>}
                {juror.bioMedium && (
                  <details className="mt-2 text-sm text-ink/80">
                    <summary className="cursor-pointer font-semibold text-collage-blue">{m.jury.readMore}</summary>
                    <p className="mt-2 whitespace-pre-line">{juror.bioMedium}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
