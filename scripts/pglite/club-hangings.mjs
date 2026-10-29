import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users(id,email) values ('${A}','a@x.invalid'),('${B}','b@x.invalid');
 insert into public.profiles(id,name) values ('${A}','A'),('${B}','B');
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s1','mp:club','pending',null from public.customers limit 1;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${A}', id, 'g-a','A','Female_Adult_01','active' from public.subscriptions limit 1;`)
const art = await db.query("select column_name from information_schema.columns where table_name='artworks' and is_nullable='NO' and column_default is null")
console.log('artworks required cols:', art.rows.map((r) => r.column_name).join(','))
await db.exec(`insert into public.artworks(id,profile_id,slug,image_url,title) values
 ('a0000000-0000-4000-8000-000000000001','${A}','a1','u','One'),
 ('a0000000-0000-4000-8000-000000000002','${A}','a2','u','Two'),
 ('a0000000-0000-4000-8000-000000000003','${A}','a3','u','Three'),
 ('b0000000-0000-4000-8000-000000000001','${B}','b1','u','Other');`)
async function as(uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const rows = (...r) => `select public.replace_club_gallery_hangings('${JSON.stringify(r)}'::jsonb)`
const hang = "select slot, artwork_id from public.club_gallery_hangings order by slot"
const one='a0000000-0000-4000-8000-000000000001', two='a0000000-0000-4000-8000-000000000002', three='a0000000-0000-4000-8000-000000000003', other='b0000000-0000-4000-8000-000000000001'
console.log('hang 2 works          :', await as(A, rows({slot:1,artwork_id:one},{slot:2,artwork_id:two})))
console.log('  now                 :', await as(A, hang))
console.log('move + swap (atomic)  :', await as(A, rows({slot:2,artwork_id:one},{slot:1,artwork_id:two},{slot:3,artwork_id:three})))
console.log('  now                 :', await as(A, hang))
console.log('slot beyond cabinet(8):', await as(A, rows({slot:9,artwork_id:one})))
console.log('  unchanged after fail:', await as(A, hang))
console.log("someone else's obra   :", await as(A, rows({slot:1,artwork_id:other})))
console.log('  unchanged after fail:', await as(A, hang))
console.log('locked frame          :', await as(A, rows({slot:1,artwork_id:one,frame_style:'gold'})))
console.log('duplicate slot        :', await as(A, rows({slot:1,artwork_id:one},{slot:1,artwork_id:two})))
console.log('same obra twice       :', await as(A, rows({slot:1,artwork_id:one},{slot:2,artwork_id:one})))
console.log('no gallery (user B)   :', await as(B, rows({slot:1,artwork_id:other})))
console.log('empty clears          :', await as(A, "select public.replace_club_gallery_hangings('[]'::jsonb)"), await as(A, hang))
console.log('anon blocked          :', await (async()=>{await db.exec("set role anon");try{await db.query(rows({slot:1,artwork_id:one}));return 'ALLOWED'}catch(e){return 'ERROR: '+e.message.split('\n')[0]}finally{await db.exec('reset role')}})())
