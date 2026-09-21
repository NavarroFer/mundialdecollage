'use client'

type StartScreenProps = {
  label: string
  onEnter: () => void
}

export function StartScreen({ label, onEnter }: StartScreenProps) {
  return (
    <div className="animate-in fade-in absolute inset-0 flex flex-col items-center justify-center gap-6 bg-ink/70 backdrop-blur-sm duration-300">
      <button
        type="button"
        id="gallery-enter-button"
        onClick={onEnter}
        className="rounded-full bg-paper px-8 py-4 font-display text-lg tracking-wide text-ink shadow-lg transition-transform hover:scale-105"
      >
        {label}
      </button>
      <p className="text-center text-xs font-semibold tracking-wide text-paper/70 uppercase">
        WASD para moverte · Shift para correr · Mouse para mirar · E para ver una obra
      </p>
    </div>
  )
}
