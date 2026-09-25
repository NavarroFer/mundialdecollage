'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Heading as HeadingIcon,
  Pilcrow,
  ImageIcon,
  MousePointerClick,
  Minus,
  MoveVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/onboarding-image'
import {
  createBlock,
  nextBlockId,
  renderEmailDocumentToHtml,
  type EmailBlock,
  type EmailBlockType,
  type EmailDocument,
  type BlockAlign,
  type AccentColor,
} from '@/lib/email-blocks'

const BLOCK_LABELS: Record<EmailBlockType, string> = {
  heading: 'Título',
  text: 'Texto',
  image: 'Imagen',
  button: 'Botón',
  divider: 'Separador',
  spacer: 'Espacio',
}

const BLOCK_ICONS: Record<EmailBlockType, typeof HeadingIcon> = {
  heading: HeadingIcon,
  text: Pilcrow,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  spacer: MoveVertical,
}

const inputClass =
  'mt-1 w-full rounded-xl border-2 border-ink/15 bg-background px-3 py-2 text-sm text-ink'
const labelClass = 'text-xs font-semibold text-ink'

export function EmailBlockEditor({
  value,
  onChange,
  bodyJsonFieldName = 'body_json',
  bodyHtmlFieldName = 'body_html',
}: {
  value: EmailDocument
  onChange: (doc: EmailDocument) => void
  bodyJsonFieldName?: string
  bodyHtmlFieldName?: string
}) {
  const html = renderEmailDocumentToHtml(value)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    onChange({
      blocks: value.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)),
    })
  }

  function addBlock(type: EmailBlockType) {
    onChange({ blocks: [...value.blocks, createBlock(type)] })
  }

  function removeBlock(id: string) {
    onChange({ blocks: value.blocks.filter((b) => b.id !== id) })
  }

  function duplicateBlock(id: string) {
    const index = value.blocks.findIndex((b) => b.id === id)
    if (index === -1) return
    const copy = { ...value.blocks[index], id: nextBlockId() }
    const blocks = [...value.blocks]
    blocks.splice(index + 1, 0, copy)
    onChange({ blocks })
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = value.blocks.findIndex((b) => b.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= value.blocks.length) return
    onChange({ blocks: arrayMove(value.blocks, index, target) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = value.blocks.findIndex((b) => b.id === active.id)
    const newIndex = value.blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange({ blocks: arrayMove(value.blocks, oldIndex, newIndex) })
  }

  // "block-N of M" for screen-reader announcements — the raw sortable id
  // (e.g. "block-12") means nothing spoken aloud, but dnd-kit's announcement
  // callbacks only give us that id, so we look the block back up by it.
  function describeBlock(id: string | number) {
    const index = value.blocks.findIndex((b) => b.id === id)
    if (index === -1) return String(id)
    return `${BLOCK_LABELS[value.blocks[index].type]}, posición ${index + 1} de ${value.blocks.length}`
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={bodyJsonFieldName} value={JSON.stringify(value)} />
      <input type="hidden" name={bodyHtmlFieldName} value={html} />

      <div>
        <p className={labelClass}>Agregar bloque</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(BLOCK_LABELS) as EmailBlockType[]).map((type) => {
            const Icon = BLOCK_ICONS[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/40"
              >
                <Icon className="h-3.5 w-3.5" />
                {BLOCK_LABELS[type]}
              </button>
            )
          })}
        </div>
      </div>

      <DndContext
        // A stable id, not dnd-kit's auto-incrementing default — the counter
        // starts fresh on every server render but keeps counting on the
        // client, so the two can land on different values and React flags a
        // hydration mismatch on the drag handle's aria-describedby.
        id="email-block-editor"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Para levantar un bloque, presioná la barra espaciadora. Mientras lo arrastrás, usá las flechas del teclado para moverlo. Presioná espacio de nuevo para soltarlo en su nueva posición, o escape para cancelar.',
          },
          announcements: {
            onDragStart: ({ active }) => `Se levantó el bloque ${describeBlock(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `El bloque ${describeBlock(active.id)} se movió sobre la posición de ${describeBlock(over.id)}.`
                : `El bloque ${describeBlock(active.id)} ya no está sobre una posición.`,
            onDragEnd: ({ active, over }) =>
              over
                ? `El bloque ${describeBlock(active.id)} se soltó en la posición de ${describeBlock(over.id)}.`
                : `El bloque ${describeBlock(active.id)} se soltó.`,
            onDragCancel: ({ active }) => `Se canceló el movimiento del bloque ${describeBlock(active.id)}.`,
          },
        }}
      >
        <SortableContext items={value.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {value.blocks.map((block, i) => (
              <SortableBlockCard
                key={block.id}
                block={block}
                index={i}
                total={value.blocks.length}
                onChange={(patch) => updateBlock(block.id, patch)}
                onDuplicate={() => duplicateBlock(block.id)}
                onRemove={() => removeBlock(block.id)}
                onMove={(dir) => moveBlock(block.id, dir)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {value.blocks.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-ink/15 px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no agregaste ningún bloque — usá los botones de arriba para empezar.
        </p>
      )}

      <details className="rounded-xl border-2 border-dashed border-ink/15 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Ver HTML generado</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink/5 p-2 text-[10px] whitespace-pre-wrap text-muted-foreground">
          {html}
        </pre>
      </details>
    </div>
  )
}

function SortableBlockCard({
  block,
  index,
  total,
  onChange,
  onDuplicate,
  onRemove,
  onMove,
}: {
  block: EmailBlock
  index: number
  total: number
  onChange: (patch: Partial<EmailBlock>) => void
  onDuplicate: () => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const Icon = BLOCK_ICONS[block.type]

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border-2 border-ink/15 bg-card p-3">
      <div className="flex items-center gap-2 border-b border-ink/10 pb-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded-md p-2 text-muted-foreground hover:bg-ink/5 hover:text-ink active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">{BLOCK_LABELS[block.type]}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-md p-2 text-muted-foreground hover:bg-ink/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Mover arriba"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-md p-2 text-muted-foreground hover:bg-ink/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Mover abajo"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-md p-2 text-muted-foreground hover:bg-ink/5 hover:text-ink"
            aria-label="Duplicar bloque"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-2 text-collage-red/70 hover:bg-collage-red/10 hover:text-collage-red"
            aria-label="Borrar bloque"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="pt-3">
        <BlockFields block={block} onChange={onChange} />
      </div>
    </div>
  )
}

function AlignPicker({ value, onChange }: { value: BlockAlign; onChange: (align: BlockAlign) => void }) {
  const options: { value: BlockAlign; icon: typeof AlignLeft; label: string }[] = [
    { value: 'left', icon: AlignLeft, label: 'Izquierda' },
    { value: 'center', icon: AlignCenter, label: 'Centro' },
    { value: 'right', icon: AlignRight, label: 'Derecha' },
  ]
  return (
    <div className="mt-1 flex gap-1">
      {options.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={label}
          className={`rounded-lg border-2 p-2 ${
            value === v ? 'border-ink bg-ink text-paper' : 'border-ink/15 text-muted-foreground hover:border-ink/40'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: AccentColor; onChange: (color: AccentColor) => void }) {
  const options: { value: AccentColor; className: string; label: string }[] = [
    { value: 'red', className: 'bg-collage-red', label: 'Rojo' },
    { value: 'blue', className: 'bg-collage-blue', label: 'Azul' },
    { value: 'ink', className: 'bg-ink', label: 'Negro' },
  ]
  return (
    <div className="mt-1 flex gap-2">
      {options.map(({ value: v, className, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={label}
          className={`h-7 w-7 rounded-full ${className} ${
            value === v ? 'ring-2 ring-ink ring-offset-2' : ''
          }`}
        />
      ))}
    </div>
  )
}

function BlockFields({ block, onChange }: { block: EmailBlock; onChange: (patch: Partial<EmailBlock>) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Texto</label>
            <input
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <label className={labelClass}>Alineación</label>
              <AlignPicker value={block.align} onChange={(align) => onChange({ align })} />
            </div>
            <div>
              <label className={labelClass}>Tamaño</label>
              <select
                value={block.size}
                onChange={(e) => onChange({ size: e.target.value as 'sm' | 'md' | 'lg' })}
                className={inputClass}
              >
                <option value="sm">Chico</option>
                <option value="md">Mediano</option>
                <option value="lg">Grande</option>
              </select>
            </div>
          </div>
        </div>
      )

    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Texto</label>
            <textarea
              rows={4}
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Alineación</label>
            <AlignPicker value={block.align} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      )

    case 'image':
      return <ImageBlockFields block={block} onChange={onChange} />

    case 'button':
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Texto del botón</label>
              <input
                value={block.text}
                onChange={(e) => onChange({ text: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Link</label>
              {/* Text, not type="url": the automatic mails put a per-artist
                  link here as a tag ({{link_obra}}, lib/system-templates.ts),
                  which the browser's URL validation would refuse to save. */}
              <input
                type="text"
                inputMode="url"
                placeholder="https://… o {{link_obra}}"
                value={block.url}
                onChange={(e) => onChange({ url: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <label className={labelClass}>Alineación</label>
              <AlignPicker value={block.align} onChange={(align) => onChange({ align })} />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <ColorPicker value={block.color} onChange={(color) => onChange({ color })} />
            </div>
          </div>
        </div>
      )

    case 'divider':
      return <p className="text-xs text-muted-foreground">Una línea horizontal para separar secciones.</p>

    case 'spacer':
      return (
        <div>
          <label className={labelClass}>Tamaño</label>
          <select
            value={block.size}
            onChange={(e) => onChange({ size: e.target.value as 'sm' | 'md' | 'lg' })}
            className={inputClass}
          >
            <option value="sm">Chico</option>
            <option value="md">Mediano</option>
            <option value="lg">Grande</option>
          </select>
        </div>
      )
  }
}

function ImageBlockFields({
  block,
  onChange,
}: {
  block: Extract<EmailBlock, { type: 'image' }>
  onChange: (patch: Partial<EmailBlock>) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Formato no soportado — usá jpg, png, webp o gif.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen pesa más de 15MB.')
      return
    }
    setError(null)
    setUploading(true)
    const supabase = createClient()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `templates/${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from('email-assets')
      .upload(path, file, { contentType: file.type })
    if (uploadError) {
      setUploading(false)
      setError('No se pudo subir la imagen.')
      return
    }
    const { data } = supabase.storage.from('email-assets').getPublicUrl(path)
    setUploading(false)
    onChange({ url: data.publicUrl })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Imagen</label>
        <div className="mt-1 flex items-center gap-3">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.url} alt="" className="h-14 w-14 rounded-lg border-2 border-ink/15 object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-ink/15 text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/40">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Subiendo…' : 'Subir imagen'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
        {error && <p className="mt-1 text-xs text-collage-red">{error}</p>}
        <input
          type="url"
          placeholder="…o pegá una URL de imagen"
          value={block.url}
          onChange={(e) => onChange({ url: e.target.value })}
          className={`${inputClass} text-xs`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Texto alternativo</label>
          <input value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Link (opcional)</label>
          <input
            type="url"
            placeholder="https://…"
            value={block.link}
            onChange={(e) => onChange({ link: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Ancho ({block.widthPct}%)</label>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={block.widthPct}
          onChange={(e) => onChange({ widthPct: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </div>
    </div>
  )
}
