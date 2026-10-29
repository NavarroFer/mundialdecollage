import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
await applyMigrations(db)
const U='11111111-1111-1111-1111-111111111111', V='22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users(id,email) values ('${U}','a@x.invalid'),('${V}','b@x.invalid');
 insert into public.profiles(id,name) values ('${U}','A'),('${V}','B');
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s1','mp:club','pending',null from public.customers limit 1;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${U}', id, 'draft-g','Draft','adult-female-01','draft' from public.subscriptions limit 1;
 insert into public.club_wallets(user_id,balance) values ('${U}',500),('${V}',500);`)
async function as(role, uid, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
console.log('anon sees draft gallery   :', await as('anon', null, "select slug from public.club_galleries"))
await db.exec("update public.club_galleries set status='active'")
console.log('anon sees active gallery  :', await as('anon', null, "select slug from public.club_galleries"))
console.log('anon reads wallets        :', await as('anon', null, "select * from public.club_wallets"))
console.log('owner reads wallets       :', await as('authenticated', U, "select user_id, balance from public.club_wallets"))
console.log('owner edits own balance   :', await as('authenticated', U, "update public.club_wallets set balance = 999999 where user_id = '"+U+"' returning balance"))
console.log('owner inserts coin tx     :', await as('authenticated', U, "insert into public.coin_transactions(user_id,delta,kind,reference_id) values ('"+U+"',1000,'purchase','x') returning id"))
console.log('owner unlocks free item   :', await as('authenticated', U, "insert into public.user_gallery_inventory(user_id,item_id) values ('"+U+"','theme:museum') returning item_id"))
console.log('owner sets locked theme   :', await as('authenticated', U, "update public.club_galleries set theme='museum' where user_id='"+U+"' returning theme"))
console.log('other edits gallery       :', await as('authenticated', V, "update public.club_galleries set title='hacked' where slug='draft-g' returning title"))
console.log('authed calls credit coins :', await as('authenticated', U, "select public.credit_club_coins('"+U+"',9999,'purchase','evil')"))
console.log('other spends for owner    :', await as('authenticated', V, "select public.spend_coins_on_item('frame:gold')"))
