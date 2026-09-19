'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/resend'

// Accepts one entry per line, in any of: "email", "email, Name", or
// "Name <email>" — matches how people tend to paste lists out of an inbox
// export or a spreadsheet column.
function parseContactLine(line: string): { email: string; name: string | null } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const angleMatch = trimmed.match(/^(.*)<([^>]+)>$/)
  if (angleMatch) {
    const name = angleMatch[1].trim().replace(/^"|"$/g, '')
    const email = angleMatch[2].trim()
    return isValidEmail(email) ? { email, name: name || null } : null
  }

  const [emailPart, ...rest] = trimmed.split(',')
  const email = emailPart.trim()
  if (!isValidEmail(email)) return null
  const name = rest.join(',').trim()
  return { email, name: name || null }
}

export async function importContacts(formData: FormData) {
  const raw = String(formData.get('emails') ?? '')
  const source = String(formData.get('source') ?? 'manual').trim() || 'manual'

  const parsed = raw
    .split('\n')
    .map(parseContactLine)
    .filter((entry): entry is { email: string; name: string | null } => entry !== null)

  if (parsed.length === 0) {
    redirect('/admin/contactos?error=no_valid_emails')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .upsert(
      parsed.map((p) => ({ email: p.email.toLowerCase(), name: p.name, source })),
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    redirect(`/admin/contactos?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/contactos')
  redirect(`/admin/contactos?imported=${parsed.length}`)
}

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
