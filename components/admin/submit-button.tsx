'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import type { VariantProps } from 'class-variance-authority'
import { Button, buttonVariants } from '@/components/ui/button'

// Must be a component of its own (not inlined in the page/form) — useFormStatus
// only reports the parent <form>'s state to descendants, never to the component
// that renders the <form> itself.
export function SubmitButton({
  children,
  pendingLabel = 'Procesando…',
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    pendingLabel?: React.ReactNode
  }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
