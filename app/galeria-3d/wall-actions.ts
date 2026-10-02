'use server'

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { authorName } from '@/lib/gallery-author'
import { WALL_BUCKET, wallPhotoPattern, type WallLives, type WallPiece, type WallState } from '@/lib/collage-wall'

// The collective collage on Room 1's end wall (supabase/migrations/
// 20261002180000_collage_wall.sql). The browser uploads the photo into its
// own folder of the 'wall' bucket; these place it and read the week's
// collage. Error codes, not sentences: the gallery shows them in the
// reader's language.
const unavailable = 'unavailable'
// The newest approved pieces of the week, enough to cover the frame many
// times over without loading hundreds of photos into the gallery.
const MAX_PIECES = 150

type PieceRow = { id: string; image_path: string; x: number; y: number; rotation: number; status: string; created_at: string }
type LivesRow = { lives: number; next_life_at: string | null }
type AdminClient = ReturnType<typeof createAdminClient>

function isConfigured() {
  return isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function getSessionUser(): Promise<User | null> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

const isUnlimited = (user: User) => ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

function toPiece(admin: AdminClient, row: PieceRow): WallPiece {
  return {
    id: row.id,
    url: admin.storage.from(WALL_BUCKET).getPublicUrl(row.image_path).data.publicUrl,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    pending: row.status === 'pending',
  }
}

function toLives(row: LivesRow, user: User): WallLives {
  return { lives: row.lives, nextLifeAt: row.next_life_at, unlimited: isUnlimited(user) }
}

async function livesOf(admin: AdminClient, user: User): Promise<WallLives | null> {
  const { data, error } = await admin.rpc('wall_lives', { visitor: user.id }).single()
  return error || !data ? null : toLives(data as LivesRow, user)
}

/** This week's collage — approved pieces, plus the visitor's own still in review — and their lives. */
export async function getWall(): Promise<WallState | { error: string }> {
  if (!isConfigured()) return { error: unavailable }
  try {
    const admin = createAdminClient()
    const [user, week] = await Promise.all([getSessionUser(), admin.rpc('wall_week_start')])
    if (week.error || !week.data) return { error: unavailable }
    const columns = 'id, image_path, x, y, rotation, status, created_at'
    const [approved, own, lives] = await Promise.all([
      admin.from('wall_pieces').select(columns).eq('week_start', week.data).eq('status', 'approved')
        .order('created_at', { ascending: false }).limit(MAX_PIECES),
      user
        ? admin.from('wall_pieces').select(columns).eq('week_start', week.data).eq('user_id', user.id).eq('status', 'pending')
        : Promise.resolve({ data: [] as PieceRow[], error: null }),
      user ? livesOf(admin, user) : Promise.resolve(null),
    ])
    if (approved.error || own.error || (user && !lives)) return { error: unavailable }
    // Oldest first: each new piece is pasted over the ones before it.
    const pieces = [...(approved.data ?? []), ...(own.data ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((row) => toPiece(admin, row as PieceRow))
    return { pieces, lives, userId: user?.id ?? null, weekStart: String(week.data) }
  } catch {
    return { error: unavailable }
  }
}

const inFrame = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

export async function placeWallPiece(input: { path: string; x: number; y: number }): Promise<{ piece: WallPiece; lives: WallLives } | { error: string; lives?: WallLives }> {
  if (!isConfigured()) return { error: unavailable }
  if (!input || typeof input.path !== 'string' || !inFrame(input.x) || !inFrame(input.y)) return { error: 'invalid' }
  try {
    const user = await getSessionUser()
    if (!user) return { error: 'sign_in_required' }
    // The bucket policy already keeps uploads inside `${uid}/`, but the path
    // arrives from the browser: re-check it's this visitor's own photo.
    const match = wallPhotoPattern.exec(input.path)
    if (!match || match[1] !== user.id) return { error: 'invalid' }

    const admin = createAdminClient()
    const bucket = admin.storage.from(WALL_BUCKET)
    const { data: files, error: listError } = await bucket.list(user.id, { search: match[2] })
    if (listError || !files?.some((file) => file.name === match[2])) return { error: 'upload_failed' }

    const { data, error } = await admin.rpc('place_wall_piece', {
      visitor: user.id,
      visitor_name: await authorName(user),
      visitor_email: user.email?.toLowerCase() ?? null,
      photo_path: input.path,
      at_x: input.x,
      at_y: input.y,
      unlimited: isUnlimited(user),
    }).single()
    const row = data as ({ status: string; piece_id: string | null; piece_rotation: number | null } & LivesRow) | null
    if (error || !row || row.status !== 'placed' || !row.piece_id) {
      // Not on the collage, so the photo has nowhere to be.
      await bucket.remove([input.path])
      return row?.status === 'no_lives' ? { error: 'no_lives', lives: toLives(row, user) } : { error: 'save_failed' }
    }

    // Same as a comment: whoever pastes joins the mailing list (never
    // re-subscribing someone who opted out). Best-effort.
    if (user.email) {
      try {
        await admin.from('contacts')
          .upsert({ email: user.email.toLowerCase(), source: 'galeria-3d' }, { onConflict: 'email', ignoreDuplicates: true })
      } catch {}
    }

    const piece = toPiece(admin, {
      id: row.piece_id,
      image_path: input.path,
      x: input.x,
      y: input.y,
      rotation: row.piece_rotation ?? 0,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    return { piece, lives: toLives(row, user) }
  } catch {
    return { error: 'save_failed' }
  }
}
