import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
console.log('failed:', (await applyMigrations(db)).map((f) => f[0]))
const A='11111111-1111-1111-1111-111111111111'
await db.exec(`insert into auth.users(id,email) values ('${A}','a@x.invalid'); insert into public.profiles(id,name) values ('${A}','A');
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status) values ('${A}','g-a','A','Female_Adult_01','active');`)
async function setUrl(value) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${A}',false)`)
  try { await db.query('update public.club_galleries set contact_url = $1 where user_id = $2', [value, A]); return 'accepted' }
  catch (e) { return 'rejected: ' + e.message.split('\n')[0].slice(0, 60) } finally { await db.exec('reset role') }
}
for (const v of ['https://ana.example/obra', 'HTTP://ana.example', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x', ' https://leading-space', null])
  console.log(String(v).padEnd(28), await setUrl(v))
