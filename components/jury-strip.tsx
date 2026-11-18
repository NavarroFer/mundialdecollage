import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getI18n } from '@/lib/i18n/server'
import { getPublicJury } from '@/lib/jury-public'
import { jurorPhotoUrl } from '@/lib/juror-profile'
import { cn } from '@/lib/utils'

const MAX_FACES = 5

// One thin row for the obra feed and «El mundial»: the jurors' faces, a title
// and the way to the full section on the home. Nothing until the jury is
// published (/admin/jurado). Kept to one line on a phone so the first obra
// still shows in the lower half of the screen.
export async function JuryStrip({ className }: { className?: string }) {
  const [{ m }, jurors] = await Promise.all([getI18n(), getPublicJury()])
  if (jurors.length === 0) return null
  return (
    <Link
      href="/?sitio=1#jurado"
      className={cn(
        'group flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card px-3 py-2.5 hover:bg-ink/5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-collage-blue sm:px-4',
        className,
      )}
    >
      <span aria-hidden className="flex shrink-0 -space-x-3">
        {jurors.slice(0, MAX_FACES).map((juror) => (
          <span key={juror.id} className="relative size-10 overflow-hidden rounded-full border-2 border-card bg-muted">
            {juror.photoPath
              ? <Image src={jurorPhotoUrl(juror.photoPath)} alt="" fill sizes="40px" className="object-cover" />
              : <span className="absolute inset-0 flex items-center justify-center font-display text-sm text-muted-foreground">{juror.name.charAt(0)}</span>}
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg leading-tight tracking-tight text-ink uppercase">{m.jury.stripTitle}</span>
        <span className="block truncate text-sm text-muted-foreground">{m.jury.stripBody}</span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 text-ink motion-safe:transition-transform motion-safe:group-hover:translate-x-1" strokeWidth={2.5} />
    </Link>
  )
}
