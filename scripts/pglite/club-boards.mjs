// A Club gallery's kraft board (20261029240000): its pieces wait for the
// member, not the admins; the member's own go up approved; the admins'
// count is the museum's collage only.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', V = '00000000-0000-4000-8000-000000000002'
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${V}','v@x.invalid');
 insert into public.club_galleries(id,user_id,slug,title,host_avatar_id,status,courtesy_granted_at) values ('c0000000-0000-4000-8000-000000000001','${M}','fer-g','Taller Fer','Female_Adult_01','active',now());`)
const G = 'c0000000-0000-4000-8000-000000000001'
const place = async (who, n, board = G) => JSON.stringify((await db.query(
  `select status, lives from public.place_club_board_piece($1,'N',null,$2,0.5,0.5,false,$3)`, [who, `${who}/p${n}.jpg`, board])).rows)
console.log('visitor pastes           :', await place(V, 1))
console.log('member pastes            :', await place(M, 2))
console.log('pieces                   :', JSON.stringify((await db.query("select user_id = $1 as member, status from public.wall_pieces order by created_at", [M])).rows))
console.log('member notified          :', JSON.stringify((await db.query("select type, data->>'count' as count from public.notifications where user_id = $1", [M])).rows))
console.log('admin count (museum only):', JSON.stringify((await db.query("select public.admin_notice_count('admin_wall_pending') as n")).rows))
await db.exec(`update public.wall_pieces set status = 'approved', moderated_at = now() where user_id = '${V}'`)
console.log('author told              :', JSON.stringify((await db.query("select type, data->>'slug' as slug from public.notifications where user_id = $1", [V])).rows))
await db.exec(`update public.club_galleries set status = 'paused'`)
console.log('paused gallery           :', await place(V, 3))
await db.exec('set role authenticated')
try { await db.query(`select * from public.place_club_board_piece('${V}','N',null,'x',0.5,0.5,true,'${G}')`); console.log('member of public calls  : allowed?!') } catch (e) { console.log('visitor calls directly   :', e.message.split('\n')[0]) }
await db.exec('reset role')
