import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users(id,email) values ('${A}','Member@X.invalid'),('${B}','other@x.invalid');
 insert into public.profiles(id,name) values ('${A}','A'),('${B}','B');
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s1','mp:club','pending',null from public.customers limit 1;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status) select '${A}', id, 'g-a','A','Female_Adult_01','paused' from public.subscriptions limit 1;`)
async function as(role, claims, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims','${claims}',false), set_config('request.jwt.claim.sub','',false);`)
  try { return JSON.stringify((await db.query(sql)).rows) } catch (e) { return 'ERROR: ' + e.message.split('\n')[0] } finally { await db.exec('reset role') }
}
console.log('service_role     :', await as('service_role', '{"role":"service_role"}', 'select * from public.club_member_emails()'))
console.log('admin (authed)   :', await as('authenticated', '{"role":"authenticated","email":"mundialdecollage@gmail.com"}', 'select * from public.club_member_emails()'))
console.log('authenticated    :', await as('authenticated', '{"role":"authenticated","email":"other@x.invalid"}', 'select * from public.club_member_emails()'))
console.log('anon             :', await as('anon', '{}', 'select * from public.club_member_emails()'))
await db.exec("insert into public.campaigns(subject, body_html, audience) values ('s','b','club_prospects')")
console.log('new audience ok  :', JSON.stringify((await db.query("select audience from public.campaigns")).rows))
try { await db.exec("insert into public.campaigns(subject, body_html, audience) values ('s','b','nope')"); console.log('bad audience     : ALLOWED') } catch { console.log('bad audience     : rejected') }
