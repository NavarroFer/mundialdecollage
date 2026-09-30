import { createAdminClient } from '@/lib/supabase/admin'

export async function upsertCustomer(email: string, fullName: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customers')
    .upsert({ email: email.toLowerCase(), full_name: fullName }, { onConflict: 'email' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Unable to save customer: ${error?.message ?? 'unknown error'}`)
  return data.id as string
}
