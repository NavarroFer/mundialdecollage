import { boot, applyMigrations } from './harness.mjs'

// The same store scenario, run on the schema before the Club's migrations and after them.
async function scenario(stopBefore) {
  const db = await boot()
  await applyMigrations(db, stopBefore)
  const out = {}
  const U = '11111111-1111-1111-1111-111111111111'
  await db.exec(`insert into auth.users(id,email) values ('${U}','a@x.invalid'); insert into public.profiles(id,name,is_public) values ('${U}','A',true);
    insert into public.customers(email,full_name) values ('c@x.invalid','C');
    insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
      select id,'mercadopago','mp-sub-1','mp:miembro','pending','{"country_code":"AR","address_line_1":"Calle 1"}'::jsonb from public.customers;
    insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
      select id,'paypal','pp-sub-1','P-MIEMBRO','pending','{"country_code":"US","address_line_1":"Main St"}'::jsonb from public.customers;
    insert into public.artworks(id,profile_id,slug,image_url,title,is_selected) values ('a0000000-0000-4000-8000-000000000001','${U}','obra-1','u','Obra',true);`)
  const one = async (label, sql, params = []) => { try { const r = await db.query(sql, params); out[label] = JSON.stringify(r.rows) } catch (e) { out[label] = 'ERROR: ' + e.message.split('\n')[0] } }
  await one('mp payment 1', "select public.record_subscription_payment('mercadopago','mp-pay-1','mp-sub-1',36000,1500,'ARS') as recorded")
  await one('mp payment 1 again', "select public.record_subscription_payment('mercadopago','mp-pay-1','mp-sub-1',36000,1500,'ARS') as recorded")
  await one('mp payment 2', "select public.record_subscription_payment('mercadopago','mp-pay-2','mp-sub-1',36000,1500,'ARS') as recorded")
  await one('mp unknown sub', "select public.record_subscription_payment('mercadopago','mp-pay-9','nope',1,0,'ARS')")
  await one('paypal payment 1', "select public.record_paypal_subscription_payment('pp-pay-1','pp-sub-1',36,1.5,'USD') as recorded")
  await one('paypal payment 1 again', "select public.record_paypal_subscription_payment('pp-pay-1','pp-sub-1',36,1.5,'USD') as recorded")
  await one('payments', "select provider, provider_payment_id, kind, amount::text, currency from public.payments order by provider_payment_id")
  await one('shipments', "select p.provider_payment_id, s.status, s.shipping_address->>'country_code' as country from public.shipments s join public.payments p on p.id = s.payment_id order by 1")
  await one('subscriptions', "select provider_subscription_id, status from public.subscriptions order by 1")
  await one('like', "select public.like_gallery_artwork('obra-1','fan@x.invalid') as r")
  await one('like again', "select public.like_gallery_artwork('obra-1','fan@x.invalid') as r")
  await one('likes stored', "select email from public.artwork_likes")
  const C = '22222222-2222-2222-2222-222222222222'
  await db.exec(`insert into auth.users(id,email) values ('${C}','c2@x.invalid')`)
  for (const slug of ['obra-1']) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${C}',false)`)
    // resets_at is left out: it is the clock of each run, not the behaviour.
    await one('stamp', 'select status, remaining from public.collect_gallery_artwork_stamp($1)', [slug])
    await one('stamp again', 'select status, remaining from public.collect_gallery_artwork_stamp($1)', [slug])
    await db.exec('reset role')
  }
  return out
}
const before = await scenario('20261029120000_club_galleries.sql')
const after = await scenario()
let different = 0
for (const key of Object.keys(before)) {
  const same = before[key] === after[key]
  if (!same) different++
  console.log(`${same ? 'same     ' : 'DIFFERENT'} ${key.padEnd(22)} ${same ? before[key].slice(0, 90) : `\n    before: ${before[key]}\n    after : ${after[key]}`}`)
}
console.log(different ? `\n${different} DIFFERENCES` : '\nidentical before and after')
