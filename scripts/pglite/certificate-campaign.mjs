// «Artistas con certificado» (20261128120000_certificate_campaign.sql): who
// the certificate reminder goes to, and that only admins can ask.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const A = '11111111-1111-1111-1111-111111111111' // selected obra, subscribed: in
const B = '22222222-2222-2222-2222-222222222222' // no country: out
const C = '33333333-3333-3333-3333-333333333333' // unsubscribed: out
const D = '44444444-4444-4444-4444-444444444444' // only an archived obra: out
await db.exec(`insert into auth.users(id,email) values ('${A}','Ana@X.invalid'),('${B}','bea@x.invalid'),('${C}','cai@x.invalid'),('${D}','dan@x.invalid');
 insert into public.profiles(id,name,country_code) values ('${A}','Ana Pérez','AR'),('${B}','Bea',null),('${C}','Cai','CL'),('${D}','Dan','MX');
 insert into public.artworks(profile_id,slug,title,image_url,is_selected) values
   ('${A}','ana-1','Uno','https://x/1.jpg',true),('${A}','ana-2','Dos','https://x/2.jpg',false),
   ('${B}','bea-1','Bea','https://x/3.jpg',true),('${C}','cai-1','Cai','https://x/4.jpg',true);
 insert into public.artworks(profile_id,slug,title,image_url,is_selected,archived_at) values ('${D}','dan-1','Dan','https://x/5.jpg',true,now());
 insert into public.contacts(email,name,subscribed) values ('ana@x.invalid','Ana',true),('bea@x.invalid','Bea',true),('cai@x.invalid','Cai',false),('dan@x.invalid','Dan',true);`)
async function as(role, claims, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims','${claims}',false), set_config('request.jwt.claim.sub','',false);`)
  try { return JSON.stringify((await db.query(sql)).rows) } catch (e) { return 'ERROR: ' + e.message.split('\n')[0] } finally { await db.exec('reset role') }
}
const q = 'select artist_name, artwork_slug, artwork_title from public.certificate_campaign_contacts()'
console.log('service_role  :', await as('service_role', '{"role":"service_role"}', q))
console.log('admin         :', await as('authenticated', '{"role":"authenticated","email":"mundialdecollage@gmail.com"}', q))
console.log('authenticated :', await as('authenticated', '{"role":"authenticated","email":"ana@x.invalid"}', q))
console.log('anon          :', await as('anon', '{}', q))
await db.exec("insert into public.campaigns(subject, body_html, audience) values ('s','b','certificates')")
console.log('audience ok   :', JSON.stringify((await db.query("select audience from public.campaigns")).rows))
