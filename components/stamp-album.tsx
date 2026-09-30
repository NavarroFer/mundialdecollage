import { StampAlbumClient } from '@/components/stamp-album-client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export async function StampAlbum() {
  if (!isSupabaseConfigured) return <StampAlbumClient signedIn={false} unlockedStamps={[]} />
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <StampAlbumClient signedIn={false} unlockedStamps={[]} />
  const { data } = await supabase.from('profile_stamps').select('stamp_key')
  const unlockedStamps = (data ?? []).flatMap((row) => row.stamp_key === 'first' || row.stamp_key === 'gallery' || row.stamp_key === 'world' ? [row.stamp_key] : [])
  return <StampAlbumClient signedIn unlockedStamps={unlockedStamps} />
}
