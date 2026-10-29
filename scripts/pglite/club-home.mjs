// The member's «house» on the map (20261029200000): stored rounded to a
// tenth of a degree, both coordinates or none, and only the owner moves it.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', O = '00000000-0000-4000-8000-000000000002'
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${O}','o@x.invalid');
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at)
   values ('${M}','g','G','Female_Adult_01','active',now());`)
async function as(role, uid, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
console.log('owner sets a precise point :', await as('authenticated', M, "update public.club_galleries set home_lat = -38.00523, home_lng = -57.55741 where user_id = '" + M + "' returning home_lat, home_lng"))
console.log('only one coordinate        :', await as('authenticated', M, "update public.club_galleries set home_lat = null where user_id = '" + M + "' returning home_lat"))
console.log('outside the globe          :', await as('authenticated', M, "update public.club_galleries set home_lat = 95, home_lng = 0 where user_id = '" + M + "' returning home_lat"))
console.log('someone else moves it      :', await as('authenticated', O, "update public.club_galleries set home_lat = 0, home_lng = 0 where slug = 'g' returning home_lat"))
console.log('anon reads it              :', await as('anon', null, "select slug, home_lat, home_lng from public.club_galleries"))
console.log('owner clears it            :', await as('authenticated', M, "update public.club_galleries set home_lat = null, home_lng = null where user_id = '" + M + "' returning home_lat, home_lng"))
await db.exec(`update public.club_galleries set home_lat = -38, home_lng = -57.6;
 insert into public.profiles(id,name,country_code) values ('${M}','Fer Navarro','AR') on conflict (id) do update set name = excluded.name, country_code = excluded.country_code;
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,home_lat,home_lng) values ('${O}','paused-g','P','Female_Adult_01','paused',1,1);`)
console.log('anon lists every gallery  :', await as('anon', null, 'select * from public.club_map_houses()'))
