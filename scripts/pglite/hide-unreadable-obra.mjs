// Tries 20261110120000_hide_unreadable_obra_image.sql: the obra with the
// unreadable file leaves the public listing and its artist gets one notice
// (also when the migration runs twice); other obras are untouched.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const db = await boot()
await applyMigrations(db, '20261110120000_hide_unreadable_obra_image.sql')
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const base = 'https://x.supabase.co/storage/v1/object/public/artworks'
await db.exec(`
  insert into auth.users(id,email) values ('${A}','a@x.invalid'),('${B}','b@x.invalid');
  insert into public.profiles(id,name,is_public) values ('${A}','A',true),('${B}','B',true);
  insert into public.artworks(profile_id,slug,image_url,title,is_selected) values
    ('${A}','rota','${base}/legacy/31ae4699-93f1-4863-baf3-ff73da2a7ca7-1794241694072.jpg','Rota',true),
    ('${B}','sana','${base}/legacy/other-1.jpg','Sana',true);`)
const sql = readFileSync(new URL('../../supabase/migrations/20261110120000_hide_unreadable_obra_image.sql', import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)
console.log('selected:', JSON.stringify((await db.query('select slug, is_selected from public.artworks order by slug')).rows))
console.log('notices :', JSON.stringify((await db.query('select user_id, type, admin, data, read_at from public.notifications')).rows))
