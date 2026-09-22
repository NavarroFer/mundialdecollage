'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const overlayAnimation =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none'

const contentAnimation =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none'

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-50 bg-ink/70 duration-200', overlayAnimation, className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showClose = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean; overlayClassName?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-ink/10 bg-card shadow-xl duration-200 outline-none',
          contentAnimation,
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute top-3 right-3 z-10 rounded-full bg-paper/90 p-1.5 text-ink shadow transition-colors hover:bg-paper focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-semibold text-ink', className)}
      {...props}
    />
  )
}

export { Dialog, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogTitle }
