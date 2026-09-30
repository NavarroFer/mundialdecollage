import { StampAlbumClient } from '@/components/stamp-album-client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export async function StampAlbum() {
  const signedIn = isSupabaseConfigured && Boolean((await (await createClient()).auth.getUser()).data.user)
  return <StampAlbumClient signedIn={signedIn} />
}
