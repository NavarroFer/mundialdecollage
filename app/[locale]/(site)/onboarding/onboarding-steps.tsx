import { Check } from 'lucide-react'
import type { Messages } from '@/lib/i18n/messages'

type OnboardingStage = 'signin' | 'details' | 'confirmation'

const STAGES: OnboardingStage[] = ['signin', 'details', 'confirmation']

export function OnboardingSteps({
  current,
  m,
}: {
  current: OnboardingStage
  m: Messages
}) {
  const currentIndex = STAGES.indexOf(current)
  const labels = [m.auth.signIn, m.onboarding.formTitle, m.confirmation.doneTitle]

  return (
    <nav aria-label={m.onboarding.formTitle} className="mb-8">
      <ol className="grid grid-cols-3 gap-2">
        {STAGES.map((stage, index) => {
          const complete = index < currentIndex
          const active = index === currentIndex

          return (
            <li
              key={stage}
              aria-current={active ? 'step' : undefined}
              className="relative flex min-w-0 flex-col items-center text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-4 right-1/2 h-0.5 w-full ${
                    complete || active ? 'bg-collage-blue' : 'bg-ink/15'
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  complete
                    ? 'border-collage-blue bg-collage-blue text-white'
                    : active
                      ? 'border-collage-blue bg-card text-collage-blue'
                      : 'border-ink/15 bg-card text-muted-foreground'
                }`}
              >
                {complete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={`mt-2 text-xs font-semibold leading-tight ${active ? 'text-ink' : 'text-muted-foreground'}`}>
                {labels[index]}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
