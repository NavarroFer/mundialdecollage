'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function toggleSubscribed(formData: FormData) {
  const id = String(formData.get('id'))
  const subscribed = formData.get('subscribed') === 'true'

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').update({ subscribed: !subscribed }).eq('id', id)
  if (error) redirect(`/admin/contactos?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/contactos')
}

export async function deleteContact(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) redirect(`/admin/contactos?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/contactos')
}
