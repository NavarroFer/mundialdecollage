'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function completeOnboarding(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')

  const name = String(formData.get('name') ?? '').trim()
  const location = String(formData.get('location') ?? '').trim()
  if (!name || !location) {
    redirect('/onboarding?error=missing_fields')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    name,
    location,
    onboarded_at: new Date().toISOString(),
  })
  if (error) {
    redirect('/onboarding?error=save_failed')
  }

  redirect('/')
}
