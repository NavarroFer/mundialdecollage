'use client'

type StartScreenProps = {
  label: string
  onEnter: () => void
}

export function StartScreen({ label, onEnter }: StartScreenProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/70 backdrop-blur-sm">
      <button
        type="button"
        id="gallery-enter-button"
        onClick={onEnter}
        className="rounded-full bg-paper px-8 py-4 font-display text-lg tracking-wide text-ink shadow-lg transition-transform hover:scale-105"
      >
        {label}
      </button>
    </div>
  )
}
