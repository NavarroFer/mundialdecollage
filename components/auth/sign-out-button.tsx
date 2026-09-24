'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'

export function SignOutButton() {
  const router = useRouter()
  const { m } = useI18n()

  async function handleClick() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick}>
      {m.auth.signOut}
    </Button>
  )
}
