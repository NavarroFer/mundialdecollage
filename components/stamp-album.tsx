import { StampAlbumClient } from '@/components/stamp-album-client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import { isStampKey } from '@/lib/stamps'

export async function StampAlbum() {
  if (!isSupabaseConfigured) return <StampAlbumClient signedIn={false} unlockedStamps={[]} />
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <StampAlbumClient signedIn={false} unlockedStamps={[]} />
  const { data } = await supabase.from('profile_stamps').select('stamp_key')
  const unlockedStamps = (data ?? []).flatMap((row) => isStampKey(row.stamp_key) ? [row.stamp_key] : [])
  return <StampAlbumClient signedIn unlockedStamps={unlockedStamps} />
}
