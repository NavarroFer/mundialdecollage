// Club obras (20261029190000): a member uploads them with their own session,
// they can never enter the contest, the gallery reads an unpublished owner's
// name, and they do not put anyone in the «Varias obras» audience.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', O = '00000000-0000-4000-8000-000000000002'
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${O}','o@x.invalid');
 insert into public.profiles(id,name,country_code,is_public) values ('${M}','Founder','AR',false),('${O}','Other','UY',false);
 alter table public.profiles disable trigger profiles_protect_visibility; update public.profiles set is_public = false; alter table public.profiles enable trigger profiles_protect_visibility;
 insert into public.contacts(email,subscribed) values ('m@x.invalid',true);
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at)
   values ('${M}','founder-g','Founder','Female_Adult_01','active',now());`)
async function as(role, uid, sql, claims = {}) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);
    select set_config('request.jwt.claims','${JSON.stringify(claims)}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const insert = (owner, slug, extra = '') => `insert into public.artworks(profile_id,slug,image_url,title,is_club_only${extra ? ',' + extra.split('=')[0] : ''})
  values ('${owner}','${slug}','u','${slug}',true${extra ? ',' + extra.split('=')[1] : ''}) returning slug`
console.log('member uploads club obra   :', await as('authenticated', M, insert(M, 'c1')))
console.log('second club obra           :', await as('authenticated', M, insert(M, 'c2')))
console.log('for someone else           :', await as('authenticated', M, insert(O, 'evil')))
console.log('club obra as main obra     :', await as('authenticated', M, insert(M, 'c3', 'is_selected=true')))
console.log('club obra entered          :', await as('authenticated', M, insert(M, 'c4', 'is_entered=true')))
console.log('admin selects a club obra  :', await as('service_role', null, "update public.artworks set is_selected = true where slug = 'c1' returning slug"))
await db.exec(`insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select g.id, 1, a.id from public.club_galleries g, public.artworks a where a.slug = 'c1'`)
const read = "select a.slug, p.name, p.country_code from public.artworks a join public.profiles p on p.id = a.profile_id order by a.slug"
console.log('anon reads gallery author  :', await as('anon', null, read))
console.log('anon reads other profile   :', await as('anon', null, `select name from public.profiles where id = '${O}'`))
await db.exec("update public.club_galleries set status = 'paused'")
console.log('paused: anon reads author  :', await as('anon', null, read))
await db.exec("update public.club_galleries set status = 'active'")
const admin = { email: 'mundialdecollage@gmail.com', role: 'authenticated' }
console.log('«Varias obras» (club only) :', await as('authenticated', null, 'select * from public.multiple_artwork_contacts()', admin))
await db.exec(`insert into public.artworks(profile_id,slug,image_url,title) values ('${M}','x1','u','Contest 1'),('${M}','x2','u','Contest 2');
  update public.artworks set is_selected = true where slug = 'x1'; alter table public.profiles disable trigger profiles_protect_visibility; update public.profiles set is_public = true where id = '${M}'; alter table public.profiles enable trigger profiles_protect_visibility;`)
console.log('«Varias obras» (+2 contest):', await as('authenticated', null, 'select artwork_titles from public.multiple_artwork_contacts()', admin))
