// Complimentary Club galleries (20261029180000): only an admin grants them,
// coins are gifted once per form, a paying member is left alone, and a
// billing change on an old subscription never pauses a courtesy.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const id = (n) => `00000000-0000-4000-8000-00000000000${n}`
const NEW = id(1), DRAFT = id(2), PAYING = id(3), OTHER = id(4)
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values
   ('${NEW}','Nueva@X.invalid','{"full_name":"Meta Nueva"}'),('${DRAFT}','draft@x.invalid','{}'),
   ('${PAYING}','paying@x.invalid','{}'),('${OTHER}','other@x.invalid','{}');
 insert into public.profiles(id,name) values ('${NEW}','Ana Nueva'),('${DRAFT}','  '),('${PAYING}','P');
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s-draft','mp:club','pending',null from public.customers;
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s-paying','mp:club','active',null from public.customers;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${DRAFT}', id, 'draft-g','Draft','Female_Adult_01','draft' from public.subscriptions where provider_subscription_id='s-draft';
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${PAYING}', id, 'paying-g','Paying','Female_Adult_01','active' from public.subscriptions where provider_subscription_id='s-paying';`)

const ADMIN = { email: 'mundialdecollage@gmail.com', role: 'authenticated' }
async function as(claims, sql) {
  const role = claims ? 'authenticated' : 'anon'
  await db.exec(`set role ${role}; select set_config('request.jwt.claims','${JSON.stringify(claims ?? {})}',false);
    select set_config('request.jwt.claim.sub','${claims?.sub ?? ''}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const grant = (user, slug, coins, ref) => `select * from public.grant_club_courtesy_gallery('${user}','${slug}','T','Female_Adult_01',${coins},'${ref}')`
const state = async (user) => JSON.stringify((await db.query(`select g.status, g.courtesy_granted_at is not null as courtesy, g.subscription_id is not null as linked,
  coalesce((select balance from public.club_wallets where user_id = g.user_id), 0) as coins from public.club_galleries g where g.user_id = $1`, [user])).rows)

console.log('anon grants                :', await as(null, grant(NEW, 'x', 600, 'r0')))
console.log('member grants              :', await as({ email: 'other@x.invalid', sub: OTHER, role: 'authenticated' }, grant(OTHER, 'x', 600, 'r0')))
console.log('member looks up an email   :', await as({ email: 'other@x.invalid', sub: OTHER, role: 'authenticated' }, "select * from public.admin_club_account('nueva@x.invalid')"))
console.log('member lists galleries     :', await as({ email: 'other@x.invalid', sub: OTHER, role: 'authenticated' }, 'select slug from public.admin_club_galleries()'))
console.log('admin looks up (any case)  :', await as(ADMIN, "select * from public.admin_club_account(' NUEVA@x.invalid ')"))
console.log('admin looks up, no name    :', await as(ADMIN, "select * from public.admin_club_account('draft@x.invalid')"))
console.log('admin looks up, no account :', await as(ADMIN, "select * from public.admin_club_account('nadie@x.invalid')"))
console.log('grant new                  :', await as(ADMIN, grant(NEW, 'ana-nueva-00000000', 600, 'r1')), await state(NEW))
console.log('same form twice            :', await as(ADMIN, grant(NEW, 'ana-nueva-00000000', 600, 'r1')), await state(NEW))
console.log('more coins, new form       :', await as(ADMIN, grant(NEW, 'ana-nueva-00000000', 400, 'r2')), await state(NEW))
console.log('gift ledger                :', JSON.stringify((await db.query(`select kind, delta, reference_id from public.coin_transactions where user_id = $1 order by created_at`, [NEW])).rows))
console.log('anon sees courtesy gallery :', await as(null, "select slug from public.club_galleries where slug = 'ana-nueva-00000000'"))
console.log('grant draft (keeps link)   :', await as(ADMIN, grant(DRAFT, 'ignored', 0, 'r3')), await state(DRAFT))
await db.exec("update public.subscriptions set status = 'cancelled' where provider_subscription_id = 's-draft'")
console.log('old sub cancelled          :', await state(DRAFT))
console.log('grant paying member        :', await as(ADMIN, grant(PAYING, 'ignored', 600, 'r4')), await state(PAYING))
console.log('negative coins             :', await as(ADMIN, grant(OTHER, 'o', -5, 'r5')))
console.log('member sets courtesy       :', await as({ email: 'n@x.invalid', sub: NEW, role: 'authenticated' }, `update public.club_galleries set courtesy_granted_at = null where user_id = '${NEW}' returning id`))
console.log('admin list                 :', await as(ADMIN, 'select slug, status, email, courtesy_granted_at is not null as courtesy, subscription_status, balance, hung from public.admin_club_galleries() order by slug'))
const galleryId = async (user) => (await db.query('select id from public.club_galleries where user_id = $1', [user])).rows[0].id
console.log('member ends courtesy       :', await as({ email: 'other@x.invalid', sub: OTHER, role: 'authenticated' }, `select public.end_club_courtesy('${await galleryId(NEW)}') as r`))
console.log('admin ends courtesy        :', await as(ADMIN, `select public.end_club_courtesy('${await galleryId(NEW)}') as r`), await state(NEW))
console.log('ends it again              :', await as(ADMIN, `select public.end_club_courtesy('${await galleryId(NEW)}') as r`))
console.log('ends a paying one          :', await as(ADMIN, `select public.end_club_courtesy('${await galleryId(PAYING)}') as r`), await state(PAYING))
await db.exec("update public.subscriptions set status = 'active' where provider_subscription_id = 's-draft'")
console.log('end, linked sub now active :', await as(ADMIN, `select public.end_club_courtesy('${await galleryId(DRAFT)}') as r`), await state(DRAFT))
console.log('re-grant after the end     :', await as(ADMIN, grant(NEW, 'ignored', 0, 'r6')), await state(NEW))
