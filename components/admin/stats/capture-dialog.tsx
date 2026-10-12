'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Copy, Download, PanelBottom, PanelTop, Text, X } from 'lucide-react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChartViewContext, FigureBlock, useElementSize, type ChartFigure, type ChartView } from './chart-kit'
import { Segmented, ToolbarButton, ToolbarToggle } from './controls'
import { usePageView, type CapturePrefs } from './view-settings'

// A chart alone on a slide of fixed size, ready for a presentation. The
// slide is laid out at its own size (smaller for bigger text) and scaled to
// fit the screen, so what's on screen is exactly what the PNG holds. The PNG
// is drawn in the browser (html-to-image, loaded on first use): no server
// work, nothing for Vercel to render.
const RATIOS: Record<CapturePrefs['format'], number> = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1 }
const HEIGHTS: Record<CapturePrefs['text'], number> = { normal: 720, grande: 600, enorme: 500 }
const BACKGROUNDS: Record<CapturePrefs['background'], string> = { paper: 'var(--color-paper)', white: '#ffffff' }
// The long side of the exported image: 4K, sharp on any projector.
const EXPORT_LONG_SIDE = 3840

export function CaptureDialog({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  footnote,
  figure,
  scope,
  fileName,
  view,
  toolbar,
  onNotesChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  eyebrow?: string
  description?: string
  footnote?: string
  figure?: ChartFigure
  scope: 'period' | 'current'
  fileName: string
  view: ChartView
  toolbar: ReactNode
  onNotesChange: (notes: boolean) => void
  children: ReactNode
}) {
  const { capture: prefs, setCapture, periodLabel } = usePageView()
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const slideRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const height = HEIGHTS[prefs.text]
  const width = Math.round(height * RATIOS[prefs.format])
  const scale = stage.width && stage.height ? Math.min(stage.width / width, stage.height / height) : 0
  const background = BACKGROUNDS[prefs.background]
  const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
  const source = scope === 'period' ? `${periodLabel} · datos al ${today}` : `Datos actuales del sitio al ${today}`

  const render = async () => {
    const node = slideRef.current
    if (!node) throw new Error('No slide')
    const { toBlob } = await import('html-to-image')
    await document.fonts.ready
    const blob = await toBlob(node, { pixelRatio: EXPORT_LONG_SIDE / Math.max(width, height), width, height })
    if (!blob) throw new Error('Empty image')
    return blob
  }
  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    setStatus('Generando imagen…')
    try {
      await action()
      setStatus(done)
    } catch {
      setStatus('No se pudo generar la imagen. Probá de nuevo o usá una captura de pantalla.')
    } finally {
      setBusy(false)
    }
  }
  const download = () => run(async () => {
    const url = URL.createObjectURL(await render())
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'Imagen descargada.')
  // The blob goes in as a promise: Safari only allows clipboard writes
  // started in the click itself.
  const copy = () => run(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': render() })]), 'Copiada: pegala en tu presentación.')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-0 z-50 flex flex-col text-paper outline-none">
          <div className="flex flex-wrap items-center gap-2 border-b border-paper/15 px-4 py-3">
            <DialogPrimitive.Title className="font-display mr-auto text-xl tracking-tight uppercase">Captura · {title}</DialogPrimitive.Title>
            <Segmented tone="dark" label="Formato" value={prefs.format} onChange={(format) => setCapture({ format })} options={(['16:9', '4:3', '1:1'] as const).map((value) => ({ value, label: value }))} />
            <Segmented tone="dark" label="Tamaño del texto" value={prefs.text} onChange={(text) => setCapture({ text })} options={[{ value: 'normal', label: 'Texto normal' }, { value: 'grande', label: 'Grande' }, { value: 'enorme', label: 'Enorme' }]} />
            <Segmented tone="dark" label="Fondo" value={prefs.background} onChange={(value) => setCapture({ background: value })} options={[{ value: 'paper', label: 'Papel' }, { value: 'white', label: 'Blanco' }]} />
            <ToolbarButton tone="dark" icon={Copy} onClick={copy} disabled={busy}>Copiar imagen</ToolbarButton>
            <ToolbarButton tone="dark" primary icon={Download} onClick={download} disabled={busy}>Descargar PNG</ToolbarButton>
            <DialogPrimitive.Close className="rounded-full p-2 text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-paper">
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-paper/15 px-4 py-2.5">
            <span className="mr-1 text-[10px] font-bold tracking-[0.18em] text-paper/60 uppercase">Mostrar</span>
            <ToolbarToggle tone="dark" icon={PanelTop} pressed={prefs.header} onPressedChange={(header) => setCapture({ header })}>Título</ToolbarToggle>
            <ToolbarToggle tone="dark" icon={Text} pressed={view.notes} onPressedChange={onNotesChange}>Notas</ToolbarToggle>
            <ToolbarToggle tone="dark" icon={PanelBottom} pressed={prefs.footer} onPressedChange={(footer) => setCapture({ footer })}>Fuente</ToolbarToggle>
            {toolbar}
            <p role="status" className="ml-auto text-xs font-semibold text-paper/75">{status || `${width} × ${height} · se exporta a ${Math.round((EXPORT_LONG_SIDE / Math.max(width, height)) * width)} × ${Math.round((EXPORT_LONG_SIDE / Math.max(width, height)) * height)} px`}</p>
          </div>
          <div ref={stageRef} className="m-6 min-h-0 flex-1">
            <div className="flex h-full items-center justify-center">
              {scale > 0 && (
                <div style={{ width: width * scale, height: height * scale }} className="shadow-2xl">
                  <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                    <div ref={slideRef} className="flex h-full w-full flex-col px-12 py-10 text-ink" style={{ background, '--chart-surface': background } as CSSProperties}>
                      {prefs.header && (
                        <div className="flex items-start justify-between gap-10">
                          <div className="min-w-0">
                            {eyebrow && <p className="text-sm font-bold tracking-[0.18em] text-collage-red uppercase">{eyebrow}</p>}
                            <p className="font-display mt-1 text-5xl leading-none tracking-tight uppercase">{title}</p>
                            {view.notes && description && <p className="mt-3 max-w-[62ch] text-base leading-snug text-muted-foreground">{description}</p>}
                          </div>
                          {figure && <FigureBlock figure={figure} large />}
                        </div>
                      )}
                      <div className={cn('min-h-0 flex-1 overflow-hidden', prefs.header && 'mt-8')}>
                        <ChartViewContext value={{ ...view, mode: 'slide' }}>{children}</ChartViewContext>
                      </div>
                      {view.notes && footnote && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
                      {prefs.footer && (
                        <div className="mt-5 flex items-center justify-between gap-6 border-t-2 border-ink/10 pt-3">
                          <span className="font-display text-lg tracking-wide uppercase">Mundial de Collage</span>
                          <span className="text-xs font-semibold text-muted-foreground">{source}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
