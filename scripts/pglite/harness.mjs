// Embedded Postgres (PGlite) with the pieces of Supabase the migrations lean on
// (roles, auth, storage, realtime) and every migration of supabase/migrations
// applied in order. There is no local Supabase here, and a migration reaches
// production the moment it reaches main (.github/workflows/supabase-migrations.yml,
// which does not wait for the CI), so a new one is tried here first.
//
//   npm install --no-save @electric-sql/pglite
//   node scripts/pglite/harness.mjs            # applies everything, lists what fails
//   node scripts/pglite/club-roles.mjs         # one of the Club scenarios
//
// Only 20261009010000_home_stats_broadcast.sql fails (realtime.topic() is not
// stubbed); nothing the Club touches depends on it.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))
const upTo = process.argv[2] // optional: stop before this file

export async function boot() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage; create schema extensions; create schema realtime;
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ select $$;
    create table realtime.messages (id uuid default gen_random_uuid(), topic text, extension text, payload jsonb);
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz, last_sign_in_at timestamptz, phone text, created_at timestamptz default now(), updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role', ''), 'anon') $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    grant usage on schema public, auth to anon, authenticated, service_role;
  `)
  return db
}

export async function applyMigrations(db, stopBefore) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const failed = []
  for (const f of files) {
    if (stopBefore && f >= stopBefore) break
    try {
      await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
    } catch (e) {
      failed.push([f, String(e.message).split('\n')[0]])
    }
  }
  return failed
}

if (process.argv[1].endsWith('harness.mjs')) {
  const db = await boot()
  const failed = await applyMigrations(db, upTo)
  console.log('failed:', failed.length)
  for (const [f, m] of failed) console.log(' -', f, '=>', m)
}
