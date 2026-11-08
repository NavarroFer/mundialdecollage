import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const A = '11111111-1111-1111-1111-111111111111' // published, selected obra
const B = '22222222-2222-2222-2222-222222222222' // hidden by an admin
const C = '33333333-3333-3333-3333-333333333333' // published, but unsubscribed
await db.exec(`insert into auth.users(id,email) values ('${A}','Ana@X.invalid'),('${B}','bea@x.invalid'),('${C}','cai@x.invalid');
 insert into public.profiles(id,name,country_code,is_public) values ('${A}','Ana Pérez','AR',true),('${B}','Bea','UY',false),('${C}','Cai','CL',true);
 insert into public.artworks(profile_id,slug,title,image_url,is_selected) values
   ('${A}','ana-1','Uno','https://x/1.jpg',true),('${A}','ana-2','Dos','https://x/2.jpg',false),
   ('${B}','bea-1','Bea','https://x/3.jpg',true),('${C}','cai-1','Cai','https://x/4.jpg',true);
 insert into public.contacts(email,name,subscribed) values ('ana@x.invalid','Ana',true),('bea@x.invalid','Bea',true),('cai@x.invalid','Cai',false);
 alter table public.profiles disable trigger profiles_protect_visibility;
 update public.profiles set is_public = false where id = '${B}';
 alter table public.profiles enable trigger profiles_protect_visibility;`)
async function as(role, claims, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims','${claims}',false), set_config('request.jwt.claim.sub','',false);`)
  try { return JSON.stringify((await db.query(sql)).rows) } catch (e) { return 'ERROR: ' + e.message.split('\n')[0] } finally { await db.exec('reset role') }
}
const q = 'select profile_id, artist_name from public.public_profile_contacts()'
console.log('service_role  :', await as('service_role', '{"role":"service_role"}', q))
console.log('admin         :', await as('authenticated', '{"role":"authenticated","email":"mundialdecollage@gmail.com"}', q))
console.log('authenticated :', await as('authenticated', '{"role":"authenticated","email":"ana@x.invalid"}', q))
console.log('anon          :', await as('anon', '{}', q))
await db.exec("insert into public.campaigns(subject, body_html, audience) values ('s','b','public_profiles')")
console.log('audience ok   :', JSON.stringify((await db.query("select audience from public.campaigns")).rows))
console.log('profiles      :', JSON.stringify((await db.query('select name, is_public from public.profiles order by name')).rows))
