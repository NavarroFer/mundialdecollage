# Comunidad: red social de artistas en el Mundial de Collage

**Guía de implementación completa.** Está escrita para que una IA (o una persona) que no conoce el proyecto pueda construir la función de punta a punta. Fecha: 2026-11-11. Estado: nada construido todavía.

---

## 0. Antes de escribir código (obligatorio)

1. Leer `AGENTS.md` y `CLAUDE.md` en la raíz del repo. **Este Next.js tiene cambios que rompen compatibilidad** con lo que conocés. Antes de escribir rutas, server actions, caché o metadata, leer la guía correspondiente en `node_modules/next/dist/docs/`.
2. Responder y escribir textos para el usuario **en español rioplatense** (vos, «tocá», «publicá»). Los comentarios del código van en inglés, como el resto del repo.
3. Para el usuario final, el sitio tiene **9 idiomas**: es, en, pt, it, fr, de, pl, ru, id (`lib/i18n/messages/*.ts`). Todo texto visible lleva su clave en los 9. `lib/i18n/messages.test.ts` falla si falta alguna. El panel admin va solo en español.
4. Leer estos archivos como modelo antes de empezar. La función nueva copia sus patrones:
   - `supabase/migrations/20261002180000_collage_wall.sql` y `app/[locale]/(site)/galeria-3d/wall-actions.ts`: fotos subidas por visitantes, bucket propio, moderación y límites.
   - `supabase/migrations/20260925140000_artwork_comments.sql`: comentarios moderados.
   - `supabase/migrations/20261005120000_notifications.sql` y `20261005122000_user_notifications.sql`: notificaciones escritas por triggers (`notify_user`, `notify_admins`, `bump_artwork_activity`).
   - `lib/notifications/registry.ts`: cómo se muestra cada tipo de notificación.
   - `components/share-links.tsx` y `components/share-artwork.tsx`: la fila de compartir con «Imagen para historias».
   - `app/api/img/route.ts`: imágenes servidas desde R2 y el CDN.
   - `app/[locale]/(site)/anon/partners/page.tsx` y `lib/static-pages.ts`: copias estáticas de páginas públicas.
   - `scripts/pglite/harness.mjs` y `scripts/pglite/hide-unreadable-obra.mjs`: cómo probar SQL sin base local.

### Stack

- Next.js (App Router, versión nueva), React, TypeScript, Tailwind, `lucide-react`.
- Supabase: Postgres con RLS, Auth con Google y Storage.
- Vercel plan Hobby, Cloudflare R2 (caché de imágenes) y Vitest.
- Las páginas viven en `app/[locale]/(site)/…`. `proxy.ts` reescribe cada pedido a `/<locale>/…` sin que cambie la barra de direcciones.
- Clientes de Supabase:
  - `createClient()` y `getCurrentUser()` en `lib/supabase/server.ts`: sesión del usuario, solo en el servidor.
  - `createAdminClient()` en `lib/supabase/admin.ts`: service role, solo en el servidor.
  - `createPublicClient()` en `lib/supabase/public.ts`: anónimo.
  - `createClient()` en `lib/supabase/client.ts`: navegador.

### Reglas del proyecto que no se pueden romper

- **CPU de Vercel**: el plan da 4 horas de CPU activa por mes para todo el equipo. Si se termina, el sitio se pausa.
  - Nunca dibujar una imagen por pedido (satori o sharp). Si se dibuja algo, se cachea en R2 y se agrega a `lib/cost-guards.test.ts`.
  - Lo que es igual para todos se sirve con `Cache-Control` y `s-maxage`, para que responda el CDN.
  - No usar `force-dynamic`, `cookies()`, `headers()` ni `searchParams` en cosas que no lo necesitan.
  - Las rutas nuevas que no leen la sesión quedan fuera del matcher de `proxy.ts`. `/api/*` ya está fuera.
  - Los datos que el cliente puede pedir después (listas, feeds) salen de un endpoint cacheado por el CDN, no del render del servidor.
- **Copias `anon/`**:
  - Las páginas públicas de `lib/static-pages.ts` tienen una copia estática para visitantes sin sesión.
  - Un componente de esas páginas lee la sesión solo con `getCurrentUser()` o `createClient()`, y el idioma solo con `getI18n()`.
  - Después de `next build`, las rutas `anon` tienen que mostrar `●`, nunca `ƒ`.
- **ISR**: cada reconstrucción de una ruta con `revalidate` se cobra en escrituras de 8 KB. Para el feed **no** usar `revalidate`: usar headers de CDN (ver §9).
- **Realtime de Supabase**: no usarlo. El cupo gratis ya lo comparten la galería 3D y los contadores del inicio.
- **Seguridad**: nunca mandar al navegador emails ni `auth.users.id` de otras personas. El `profiles.id` de un artista público ya es público, porque va en la URL de su perfil (`artistProfileSlug(name, profileId)`). Las tablas nuevas tienen RLS cerrada y se leen y escriben desde el servidor con service role, después de verificar la sesión.
- **Admins**:
  - Se definen por email en `lib/admin.ts` (`ADMIN_EMAILS`) y en SQL con `public.is_admin()` y `public.admin_user_ids()`.
  - `lib/view-mode.ts` (`isAdminView(user)`) dice si el admin eligió «ver como artista».
  - Para la interfaz se usa `isAdminView`. Para permisos, siempre el email.
- **Migraciones**: llegan a producción apenas llegan a `main` (GitHub Actions), y CI no tiene base de datos. **Todo SQL nuevo se prueba con PGlite** (`scripts/pglite/`) antes del commit. Los nombres siguen el formato `YYYYMMDDHHMMSS_descripcion.sql`, posterior al último existente (hoy `20261110120000_…`). Las migraciones deben poder correr dos veces (`if not exists`, `create or replace`, `on conflict do nothing`).
- **Commits**: un commit por tema, nunca todo junto. Mensaje en inglés con estilo `feat(comunidad): …`. **No pushear**: el dueño pushea a `main` en lotes, porque cada deploy vacía el CDN. Antes de cualquier push, revisar `git log origin/main..HEAD`.
- **Verificación antes de cada commit**: `npx tsc --noEmit -p .`, `npx eslint <archivos>`, `npx vitest run`. Al final de cada etapa, `npx next build`, y revisar que las rutas `anon` sigan en `●`.

---

## 1. Objetivo

- **Más uso del sitio**: que un artista tenga motivos para volver aunque ya se haya inscripto (ver qué publicaron los demás, quién le dio me gusta o le comentó).
- **Más interacción entre artistas**: hoy los comentarios y los «me gusta» viven dentro de la galería 3D, que no todos abren.
- **Un inicio vivo**: arriba del inicio, publicaciones recientes de artistas reales.
- **Aprovechar lo que ya hacen**: cuando bajan la «Imagen para historias» para Instagram, ofrecer en el mismo paso «Publicala también en el Mundial».

### Lo que no se puede: traer las historias de Instagram

Instagram no deja leer las historias de cuentas personales. La Basic Display API se cerró en diciembre de 2024. La Graph API solo da historias de cuentas profesionales vinculadas a Facebook y solo por 24 horas. Por eso **la publicación sale del sitio en el momento de compartir**, con imágenes que ya son nuestras. No hay que integrar nada con Instagram.

---

## 2. Decisiones tomadas (valores por defecto)

Si el dueño no dice otra cosa, se construye así:

| Tema | Decisión |
|---|---|
| Nombre de la sección | **Comunidad**, en la ruta `/comunidad` |
| Quién publica | Solo **artistas inscriptos**: `profiles.onboarded_at` no nulo y `profiles.is_public = true` |
| Quién da me gusta y comenta | Cualquiera con sesión de Google |
| Quién ve | Todos, también sin sesión |
| Formato | Publicaciones permanentes. Sin historias de 24 h. |
| Moderación de obra y souvenir | Se publica al instante; denuncia posterior |
| Moderación de foto libre | Aprobación previa en `/admin/publicaciones` |
| Moderación de comentarios | Al instante si quien comenta es artista inscripto; previa en `/admin/comentarios` si no |
| Ocultamiento automático | Con 3 denuncias de personas distintas |
| Límites | 5 publicaciones por día y 30 comentarios por hora por persona. Admins sin límite. |
| Largo del texto | Publicación hasta 1000 caracteres; comentario hasta 500 |
| Links en el texto | Se muestran como texto plano, sin convertir en enlaces |
| Lugar en el inicio | Franja después de `ReferralInvite` y antes de `BasesBanner` |
| Franja vacía | No se muestra hasta que haya **6 o más** publicaciones |
| Barra inferior del teléfono | No se toca: ya tiene 5 pestañas |
| Realtime | No |

---

## 3. Lo que ya existe y se reusa

| Pieza | Archivo | Uso en Comunidad |
|---|---|---|
| Imagen para historias de cada obra | `app/[locale]/(site)/obras/[slug]/historia/route.tsx` | No se toca. La publicación «Mi obra» usa la imagen de la obra (`artworks.image_url`), no la de historia. |
| Fila de compartir | `components/share-links.tsx` (recibe `storyHref`) | Se le agrega un `footer` o una prop para la oferta «Publicala en el Mundial». |
| Compartir obra | `components/share-artwork.tsx` (props `slug`, `isPublic`, `isOwn`) | La oferta aparece solo con `isOwn && isPublic`. Se usa en `obras/[slug]/page.tsx`, `onboarding/confirmado/page.tsx` y `components/participation-status.tsx`. |
| Souvenir de la galería 3D | `components/gallery/ui/Souvenir.tsx` (funciones `share()` y `download()`; canvas de 1080×1920 armado en `components/gallery/souvenir/compose.ts`) | Botón nuevo «Publicar en el Mundial». |
| Subida de fotos con límite | `wall-actions.ts`, bucket `wall`, `lib/downscale-image.ts` (`downscaleImage(file)`) | El mismo flujo para el bucket nuevo `posts`. |
| Nombre visible de quien comenta | `lib/gallery-author.ts` (`authorName(user)`) | Para `post_comments.author_name`. |
| Notificaciones | `public.notify_user(recipient, kind, payload, key, for_admin, resurface)`, `public.notify_admins(kind, payload, key, resurface)`, `lib/notifications/registry.ts` | Tipos nuevos (§7). |
| Imágenes | `lib/image-src.ts` (`imageSrc(src, width)`, `imageSrcSet(src)`) | Toda imagen del feed pasa por ahí. |
| Medición | `lib/track.ts` (`track(name)`), `lib/funnel.ts` (listas de eventos que muestra `/admin/estadisticas`) | Eventos nuevos (§11). |
| Panel admin | `components/admin/admin-sections.ts` (secciones del menú), `/admin/comentarios`, `/admin/muro` | Sección nueva `/admin/publicaciones`. |
| Slug del artista | `lib/artist-slug.ts` (`artistProfileSlug(name, profileId)`) | Link al perfil desde cada publicación. |

---

## 4. Experiencia de uso

### 4.1 Franja en el inicio

Componente de cliente `components/community/community-strip.tsx`. Se inserta en `app/[locale]/(site)/page.tsx` entre `<ReferralInvite …/>` y `<BasesBanner />`.

- **No lee nada en el servidor.** Con `IntersectionObserver` (margen de unos 600 px) pide `GET /api/comunidad`.
- Si la respuesta trae menos de 6 publicaciones, no muestra nada (`return null`), sin dejar espacio vacío.
- Título «Lo que comparten los artistas» y link «Ver todo» a `/comunidad`.
- En el teléfono, carrusel horizontal con `scroll-snap`: tarjetas de unos 80 % del ancho. En escritorio, grilla de 3 columnas con 6 tarjetas.
- Para un artista inscripto, una tarjeta inicial «¿Qué estás haciendo? Publicá» que abre el compositor. Se sabe si puede publicar llamando a `communityViewer()` (§9.3) **solo si hay sesión en el navegador**: `createClient()` de `lib/supabase/client.ts` y luego `auth.getSession()`. Ese chequeo es local y no pega al servidor.
- Respetar `prefers-reduced-motion`.

### 4.2 Tarjeta de publicación

Componente `components/community/post-card.tsx`:

- **Encabezado**: miniatura del autor (su obra seleccionada, con `imageSrc(url, 128)`, redonda), nombre que lleva a `/artistas/<slug>`, bandera o país (`country_code`) y fecha relativa («hace 3 h», con `lib/i18n/format.ts`).
- **Imagen** con `imageSrcSet`, `loading="lazy"`, `alt` = título de la obra o «Foto de {nombre}». Relación de aspecto fija de 4:5, con `object-cover`.
  - En «Mi obra», la imagen y el título llevan a `/obras/<slug>`.
- **Texto** con `whitespace-pre-line`, recortado a 4 líneas con «ver más».
- **Pie**:
  - Me gusta (corazón y número). Sin sesión, al tocar abre el ingreso con Google (`useGoogleSignIn` de `components/auth/google-sign-in-button`) y vuelve a `/comunidad#post-<id>`.
  - Comentarios (globo y número): abre `comments-sheet`.
  - Compartir: `navigator.share` o copiar el link `/comunidad#post-<id>`.
  - Menú `⋯` con «Denunciar» para los demás y «Borrar» para el autor.
- Estado «En revisión» para el autor, en publicaciones `pending`.

### 4.3 Página `/comunidad`

- `app/[locale]/(site)/comunidad/page.tsx` con `SiteHeader`, `Footer` y `<CommunityFeed />` (cliente).
- Copia estática `app/[locale]/(site)/anon/comunidad/page.tsx`, igual que `anon/partners/page.tsx` (`renderAsAnonymous()`, `revalidate = 86400`).
- Agregar `'/comunidad'` a `STATIC_PAGES` en `lib/static-pages.ts`. El test `lib/static-pages.test.ts` exige que exista la copia.
- Agregar `/comunidad` al sitemap (`app/sitemap.ts` o donde estén las rutas públicas).
- Metadata: título «Comunidad · Mundial de Collage» y descripción, en los 9 idiomas.
- Feed con scroll infinito: pide la página siguiente con `?antes=<cursor>` al acercarse al final. Arriba va el compositor, si puede publicar.
- Al volver a la pestaña (`visibilitychange`) después de 2 minutos o más, pide la primera página. Si hay ids nuevos, muestra una píldora «Hay publicaciones nuevas»; al tocarla, sube y las muestra.
- Si la URL trae `#post-<id>` y la publicación no está en la primera página, se pide `GET /api/comunidad/<id>` y se muestra arriba.

### 4.4 Perfil del artista

En `app/[locale]/(site)/artistas/[slug]/page.tsx`, que es estática, va una sección «Publicaciones» con `<CommunityFeed author={profileId} />`. El cliente pide `GET /api/comunidad?autor=<profileId>`. Si no hay publicaciones, la sección no se muestra.

### 4.5 El paso de Instagram (lo más importante)

Componente `components/community/publish-artwork-offer.tsx`. Se muestra dentro de `ShareArtwork` cuando `isOwn && isPublic`:

1. El botón «Imagen para historias» sigue bajando la imagen igual que hoy.
2. **Después del clic** en ese botón (y también, más chico, siempre visible debajo de la fila) aparece una tarjeta:
   > **¿La publicamos también en el Mundial?**
   > Tus colegas la van a ver en el inicio.
   > [campo de texto opcional: «Contá algo de tu obra (opcional)»] **[Publicar]**
3. Al publicar se llama a `publishArtwork({ artworkSlug, body })`. Si sale bien, la tarjeta cambia a «¡Listo! Ya está en Comunidad · Ver publicación» (link a `/comunidad#post-<id>`).
4. Si esa obra ya está publicada (`already`), dice directamente «Ya está en Comunidad · Ver publicación». Para saberlo al montar, se llama a `communityViewer({ artworkSlug })`, que devuelve `artworkPostId`.
5. Si `isOwn && !isPublic` (obra en revisión), se muestra en gris «Cuando aprobemos tu obra vas a poder publicarla en Comunidad».

Para eso hay que cambiar `ShareLinks` así: agregar la prop opcional `onStory?: () => void`, que se llama en el `onClick` del link de historia junto con `track`, y pasar la oferta por la prop `footer` que ya existe.

### 4.6 Souvenir de la galería 3D

En `components/gallery/ui/Souvenir.tsx`, junto a «Compartir» y «Guardar», va el botón «Publicar en el Mundial». Solo se muestra si `communityViewer().canPost`.

Flujo:

1. Canvas → `toBlob('image/jpeg', 0.85)`.
2. `downscaleImage`, con un lado máximo de 1600 px.
3. Subida al bucket `posts` en `<userId>/<uuid>.jpg` con el cliente del navegador.
4. `publishImage({ kind: 'souvenir', path, body })`.

Ojo: dentro de la galería, el `userId` del navegador se obtiene de `auth.getUser()` en el cliente. Es el propio usuario, así que está permitido.

### 4.7 Compositor (foto libre, etapa 3)

Componente `components/community/post-composer.tsx`:

- Elegir imagen (`accept="image/jpeg,image/png,image/webp"`), vista previa, `downscaleImage`, texto.
- Subida y luego `publishImage({ kind: 'photo', path, body })`.
- Al terminar: «Tu foto está en revisión. Te avisamos cuando se publique».

### 4.8 Comentarios

Componente `components/community/comments-sheet.tsx`: hoja desde abajo en el teléfono y diálogo en escritorio.

- Lista con `listPostComments(postId)`. Campo de texto con `addPostComment`.
- Si queda `pending`, el autor del comentario lo ve con la marca «En revisión».

---

## 5. Base de datos

Un solo archivo, `supabase/migrations/20261112120000_community_posts.sql` (ajustar la fecha para que sea posterior a la última migración). Copiarlo completo y probarlo con PGlite (§12).

```sql
-- Comunidad (docs/red-social.md): artists post their obra, a 3D-gallery
-- souvenir or a photo of their own; anyone signed in likes and comments.
-- Every read and write for visitors goes through the server with the service
-- role (app/api/comunidad, app/[locale]/(site)/comunidad/actions.ts), so
-- emails and auth ids never reach the browser.

-- ---------------------------------------------------------------- posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  -- profiles.id = auth.users.id; only onboarded, public artists post.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('artwork', 'souvenir', 'photo')),
  artwork_id uuid references public.artworks (id) on delete cascade,
  -- Inside the 'posts' bucket: `${profile_id}/${uuid}.jpg`.
  image_path text unique,
  body text not null default '' check (char_length(body) <= 1000 and body = btrim(body)),
  status text not null default 'published'
    check (status in ('pending', 'published', 'hidden', 'removed')),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  constraint posts_kind_shape check (
    (kind = 'artwork' and artwork_id is not null and image_path is null)
    or (kind <> 'artwork' and artwork_id is null and image_path is not null)
  )
);

create index if not exists posts_feed_idx on public.posts (created_at desc, id desc) where status = 'published';
create index if not exists posts_profile_idx on public.posts (profile_id, created_at desc, id desc);
create index if not exists posts_pending_idx on public.posts (created_at) where status = 'pending';
-- An obra is posted as «Mi obra» once (deleting the post frees it).
create unique index if not exists posts_artwork_once on public.posts (artwork_id)
  where kind = 'artwork' and status <> 'removed';

-- ---------------------------------------------------------------- likes
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id, post_id);

-- ---------------------------------------------------------------- comments
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  -- Only for moderation context (/admin/comentarios); never shown publicly.
  author_email text,
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, status, created_at);
create index if not exists post_comments_user_idx on public.post_comments (user_id, created_at);
create index if not exists post_comments_pending_idx on public.post_comments (created_at) where status = 'pending';

-- ---------------------------------------------------------------- reports
create table if not exists public.post_reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------- access
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "posts: admin all" on public.posts;
create policy "posts: admin all" on public.posts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "post_comments: admin all" on public.post_comments;
create policy "post_comments: admin all" on public.post_comments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "post_reports: admin all" on public.post_reports;
create policy "post_reports: admin all" on public.post_reports for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.posts, public.post_likes, public.post_comments, public.post_reports from anon, authenticated;
grant select, update, delete on public.posts, public.post_comments, public.post_reports to authenticated; -- RLS: admins only
grant select, insert, update, delete on public.posts, public.post_likes, public.post_comments, public.post_reports to service_role;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "posts: owner upload" on storage.objects;
create policy "posts: owner upload" on storage.objects for insert
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts: owner delete" on storage.objects;
create policy "posts: owner delete" on storage.objects for delete
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "posts: admin all" on storage.objects;
create policy "posts: admin all" on storage.objects for all
  using (bucket_id = 'posts' and public.is_admin()) with check (bucket_id = 'posts' and public.is_admin());

-- ---------------------------------------------------------------- limits
-- 5 posts a day and 30 comments an hour per person; admins are exempt.
create or replace function public.community_rate_limit()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid := case when tg_table_name = 'posts' then new.profile_id else new.user_id end;
  recent integer;
begin
  if author in (select * from public.admin_user_ids()) then
    return new;
  end if;
  if tg_table_name = 'posts' then
    select count(*) into recent from public.posts
      where profile_id = author and created_at > now() - interval '24 hours';
    if recent >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  else
    select count(*) into recent from public.post_comments
      where user_id = author and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.community_rate_limit();
drop trigger if exists post_comments_rate_limit on public.post_comments;
create trigger post_comments_rate_limit before insert on public.post_comments
  for each row execute function public.community_rate_limit();

-- ---------------------------------------------------------------- activity
-- Likes and approved comments on a post, grouped per Argentine day into one
-- notice for its author, like bump_artwork_activity does for obras.
create or replace function public.bump_post_activity(post uuid, field text, actor uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  day text := to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD');
begin
  if field not in ('likes', 'comments') then
    raise exception 'bump_post_activity: unknown field %', field;
  end if;
  select profile_id into owner_id from public.posts where id = post;
  if owner_id is null or owner_id = actor then return; end if;
  insert into public.notifications as n (user_id, type, dedupe_key, data)
  values (owner_id, 'post_activity', 'post_activity:' || post || ':' || day,
          jsonb_build_object('postId', post, 'day', day, 'likes', 0, 'comments', 0) || jsonb_build_object(field, 1))
  on conflict (user_id, dedupe_key) do update
    set data = n.data || jsonb_build_object(field, coalesce((n.data ->> field)::integer, 0) + 1),
        read_at = null,
        updated_at = now();
end;
$$;

create or replace function public.on_post_like()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    perform public.bump_post_activity(new.post_id, 'likes', new.user_id);
    return new;
  end if;
  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.on_post_like();

-- comment_count counts approved comments only.
create or replace function public.on_post_comment()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was boolean := tg_op in ('UPDATE', 'DELETE') and old.status = 'approved';
  now_approved boolean := tg_op in ('INSERT', 'UPDATE') and new.status = 'approved';
  target uuid := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
begin
  if now_approved and not was then
    update public.posts set comment_count = comment_count + 1 where id = target;
    perform public.bump_post_activity(target, 'comments', new.user_id);
  elsif was and not now_approved then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = target;
  end if;
  -- A moderated comment: its author hears about it (same as obra comments).
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    perform public.notify_user(new.user_id, 'post_comment_approved', jsonb_build_object('postId', new.post_id));
  end if;
  -- A comment waiting for moderation: one grouped notice for the admins.
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify_admins('post_comments_pending',
      jsonb_build_object('count', (select count(*) from public.post_comments where status = 'pending')),
      'post_comments_pending');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists post_comments_count on public.post_comments;
create trigger post_comments_count after insert or update of status or delete on public.post_comments
  for each row execute function public.on_post_comment();

-- ---------------------------------------------------------------- moderation
-- A photo waiting for approval tells the admins; approving or hiding tells
-- its author.
create or replace function public.on_post_status()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify_admins('posts_pending',
        jsonb_build_object('count', (select count(*) from public.posts where status = 'pending')),
        'posts_pending');
    end if;
    return new;
  end if;
  if old.status = new.status then return new; end if;
  if old.status = 'pending' and new.status = 'published' then
    perform public.notify_user(new.profile_id, 'post_approved', jsonb_build_object('postId', new.id));
  elsif new.status in ('hidden', 'removed') and old.status in ('pending', 'published')
        and new.moderated_at is not null then
    -- Only when an admin did it (moderated_at set), not the author deleting.
    perform public.notify_user(new.profile_id, 'post_hidden', jsonb_build_object('postId', new.id, 'kind', new.kind));
  end if;
  return new;
end;
$$;
drop trigger if exists posts_status on public.posts;
create trigger posts_status after insert or update of status on public.posts
  for each row execute function public.on_post_status();

-- Three reports from different people hide a post until an admin looks.
create or replace function public.on_post_report()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  update public.posts set report_count = report_count + 1 where id = new.post_id
    returning report_count into total;
  if total >= 3 then
    update public.posts set status = 'hidden' where id = new.post_id and status = 'published';
  end if;
  perform public.notify_admins('post_reported',
    jsonb_build_object('postId', new.post_id, 'reports', total), 'post_reported:' || new.post_id);
  return new;
end;
$$;
drop trigger if exists post_reports_count on public.post_reports;
create trigger post_reports_count after insert on public.post_reports
  for each row execute function public.on_post_report();

-- ---------------------------------------------------------------- feed
-- The public feed, newest first, keyset-paginated by (created_at, id). Only
-- published posts by public artists, whose obra (for «Mi obra») is still
-- published. `author` narrows it to one artist's profile.
create or replace function public.community_feed(
  before_at timestamptz default null,
  before_id uuid default null,
  author uuid default null,
  page_size integer default 20
)
returns table (
  id uuid, kind text, body text, created_at timestamptz,
  like_count integer, comment_count integer,
  profile_id uuid, author_name text, author_country text, author_thumb text,
  artwork_slug text, artwork_title text, image_url text, image_path text
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.body, p.created_at, p.like_count, p.comment_count,
         pr.id, pr.name, pr.country_code,
         (select a2.image_url from public.artworks a2
            where a2.profile_id = pr.id and a2.archived_at is null and a2.image_url is not null
            order by a2.is_selected desc, a2.created_at desc limit 1),
         a.slug, a.title, a.image_url, p.image_path
  from public.posts p
  join public.profiles pr on pr.id = p.profile_id and pr.is_public
  left join public.artworks a on a.id = p.artwork_id
  where p.status = 'published'
    and (p.kind <> 'artwork' or (a.is_selected and a.archived_at is null))
    and (author is null or p.profile_id = author)
    and (before_at is null or (p.created_at, p.id) < (before_at, before_id))
  order by p.created_at desc, p.id desc
  limit least(greatest(page_size, 1), 50)
$$;
revoke all on function public.community_feed(timestamptz, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.community_feed(timestamptz, uuid, uuid, integer) to service_role;

notify pgrst, 'reload schema';
```

Notas sobre el SQL:

- Antes de escribirlo, verificar con `grep` que existan las columnas `artworks.is_selected`, `archived_at`, `image_url`, `title`, `slug`, `profile_id`, `created_at` y `profiles.name`, `country_code`, `is_public`, `onboarded_at`, y que los nombres sean esos.
- Si `notify_admins` exige otro orden o firma, ajustarlo a lo que define `20261005120000_notifications.sql`.
- Revisar cómo `/admin/comentarios` lista los comentarios pendientes de obras: los de publicaciones deben aparecer ahí también (§10), no en un panel aparte.

---

## 6. Tipos compartidos

Archivo `lib/community.ts`, puro y sin imports de servidor, para poder probarlo con Vitest:

```ts
export const POST_BODY_MAX = 1000
export const COMMENT_BODY_MAX = 500
export const FEED_PAGE_SIZE = 20
export const STRIP_MIN_POSTS = 6
export const POSTS_BUCKET = 'posts'

export type PostKind = 'artwork' | 'souvenir' | 'photo'

/** What /api/comunidad sends: same bytes for everyone, nothing personal. */
export type FeedPost = {
  id: string
  kind: PostKind
  body: string
  createdAt: string
  likes: number
  comments: number
  author: { profileId: string; name: string; countryCode: string | null; thumbUrl: string | null; href: string }
  imageUrl: string            // obra image or public URL of the bucket file
  artwork: { slug: string; title: string | null; href: string } | null
}

export type FeedPage = { posts: FeedPost[]; next: string | null }

/** `<created_at ISO>_<uuid>`; null when it doesn't parse. */
export function encodeCursor(createdAt: string, id: string): string
export function decodeCursor(value: string | null): { at: string; id: string } | null

/** Trims and validates a post/comment body; null when too long. */
export function cleanBody(value: unknown, max: number): string | null

/** `${userId}/${uuid}.(jpg|png|webp)`, the only paths a post may point to. */
export function isOwnPostPath(path: string, userId: string): boolean
```

Errores (códigos, no frases, como en `wall-actions.ts`; el cliente muestra el texto en el idioma de quien lee):

```ts
export type CommunityError =
  | 'signin'        // no session
  | 'not_artist'    // not onboarded/public: can like/comment but not post
  | 'not_found'     // post/obra missing or not visible
  | 'already'       // obra already posted
  | 'rate_limited'  // trigger community_rate_limit
  | 'too_long'
  | 'bad_image'     // path not in own folder / not uploaded
  | 'unavailable'   // config or DB error
```

---

## 7. Notificaciones

En `lib/notifications/registry.ts`, una entrada por tipo con su esquema `zod`, ícono, texto y link. Textos para usuarios en los 9 idiomas, en `notifications.types`; los de admin solo en español.

| Tipo | Para | `data` | Texto (es) | Link |
|---|---|---|---|---|
| `post_activity` | autor | `{ postId, day, likes, comments }` | «Tu publicación sumó {likes} me gusta y {comments} comentarios» (con plurales y omitiendo los ceros, como `artwork_activity`) | `/comunidad#post-{postId}` |
| `post_approved` | autor | `{ postId }` | «Publicamos tu foto en Comunidad» | `/comunidad#post-{postId}` |
| `post_hidden` | autor | `{ postId, kind }` | «Ocultamos una de tus publicaciones. Si creés que es un error, escribinos» | `/comunidad` |
| `post_comment_approved` | quien comentó | `{ postId }` | «Publicamos tu comentario» | `/comunidad#post-{postId}` |
| `posts_pending` | admin | `{ count }` | «{count} fotos de Comunidad para revisar» | `/admin/publicaciones` |
| `post_comments_pending` | admin | `{ count }` | «{count} comentarios de Comunidad para revisar» | `/admin/comentarios` |
| `post_reported` | admin | `{ postId, reports }` | «Denunciaron una publicación ({reports})» | `/admin/publicaciones?denunciadas=1` |

Íconos: reusar `comment`, `activity`, `pending`, `alert` e `image` de `NotificationIcon`.

---

## 8. Archivos nuevos y modificados

```
supabase/migrations/20261112120000_community_posts.sql      nuevo
scripts/pglite/community.mjs                                 nuevo (prueba del SQL)
lib/community.ts / lib/community.test.ts                     nuevo
lib/community-server.ts                                      nuevo (lectura con service role → FeedPost)
app/api/comunidad/route.ts                                   nuevo  GET feed
app/api/comunidad/[id]/route.ts                              nuevo  GET una publicación
app/[locale]/(site)/comunidad/page.tsx                       nuevo
app/[locale]/(site)/comunidad/actions.ts                     nuevo  server actions
app/[locale]/(site)/anon/comunidad/page.tsx                  nuevo
components/community/community-strip.tsx                     nuevo
components/community/community-feed.tsx                      nuevo
components/community/post-card.tsx                           nuevo
components/community/comments-sheet.tsx                      nuevo
components/community/publish-artwork-offer.tsx               nuevo
components/community/post-composer.tsx                       nuevo (etapa 3)
app/[locale]/(site)/admin/publicaciones/page.tsx + actions.ts nuevo
app/[locale]/(site)/page.tsx                                 + <CommunityStrip />
components/share-links.tsx / share-artwork.tsx               + oferta de publicar
components/gallery/ui/Souvenir.tsx                           + botón publicar (etapa 2)
app/[locale]/(site)/artistas/[slug]/page.tsx                 + sección Publicaciones (etapa 2)
app/[locale]/(site)/admin/comentarios/…                      + comentarios de Comunidad
components/admin/admin-sections.ts                           + «Publicaciones»
lib/static-pages.ts                                          + '/comunidad'
lib/notifications/registry.ts                                + tipos (§7)
lib/funnel.ts                                                + eventos (§11)
lib/i18n/messages/*.ts (9)                                   + bloque `community`
lib/cost-guards.test.ts                                      + guardia del feed (§9.1)
app/sitemap.ts (o equivalente)                               + /comunidad
app/[locale]/(site)/terminos-y-condiciones, politica-de-privacidad  + contenido de usuarios (etapa 3)
lib/artist-digest.ts                                         + actividad en Comunidad (etapa 2)
```

---

## 9. Backend

### 9.1 `GET /api/comunidad`

`app/api/comunidad/route.ts`:

- Parámetros: `antes` (cursor, opcional), `autor` (uuid de perfil, opcional), `n` (tamaño, opcional, de 1 a 20; por defecto 20).
- **No lee la sesión, cookies ni headers.** No exporta `revalidate`: es un handler dinámico al que el CDN le guarda la respuesta por los headers.
- Llama a `createAdminClient().rpc('community_feed', { before_at, before_id, author, page_size: n + 1 })`. Si vuelven `n + 1` filas, hay página siguiente: `next = encodeCursor(...)` de la fila `n`.
- Arma cada `FeedPost` en `lib/community-server.ts`:
  - `imageUrl`: `artworks.image_url` en «Mi obra», o `storage.from('posts').getPublicUrl(image_path)` en los otros tipos.
  - `author.href`: `/artistas/${artistProfileSlug(name, profileId)}`.
  - `artwork.href`: `/obras/${slug}`.
- Respuesta: `NextResponse.json(page, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } })`.
- Si el parámetro es inválido, responde `400` con `Cache-Control: public, s-maxage=3600`. Si falla la base, `503` con `Cache-Control: no-store`.
- Agregar a `lib/cost-guards.test.ts` (o a un test propio en `app/api/comunidad/route.test.ts`) una verificación de que el archivo no importa `next/headers` ni `lib/supabase/server` y de que la respuesta trae `s-maxage`.

`app/api/comunidad/[id]/route.ts` hace lo mismo para una sola publicación. Como `community_feed` no filtra por id, se agrega en la migración la función `community_post(post uuid)` con la misma selección, o se filtra en el servidor. Usa `s-maxage=60`.

### 9.2 Server actions

`app/[locale]/(site)/comunidad/actions.ts`, con `'use server'`. Cada una:

- obtiene el usuario con `(await createClient()).auth.getUser()`, porque en actions no se usa `getCurrentUser`;
- valida;
- escribe con `createAdminClient()`;
- devuelve `{ ok: true, … } | { error: CommunityError }`;
- traduce el error `rate_limited` del trigger (mensaje `rate_limited`) al código.

```ts
// Can this person post? Also what they already liked among visible ids,
// which of those are theirs, and (with artworkSlug) whether that obra is
// already posted. One call per page view, only when there is a session.
communityViewer(input: { postIds?: string[]; artworkSlug?: string }):
  Promise<{ signedIn: boolean; canPost: boolean; liked: string[]; mine: string[]; artworkPostId: string | null }>

publishArtwork(input: { artworkSlug: string; body?: string }):
  Promise<{ ok: true; id: string } | { error: CommunityError }>
  // the obra must belong to the user, be is_selected, not archived, not
  // is_club_only, and the profile onboarded + public → status 'published'

publishImage(input: { kind: 'souvenir' | 'photo'; path: string; body?: string }):
  Promise<{ ok: true; id: string; pending: boolean } | { error: CommunityError }>
  // isOwnPostPath(path, user.id) and the file exists in the bucket
  // (storage.from('posts').list(user.id, { search: name })).
  // souvenir → 'published'; photo → 'pending'

deletePost(id: string): Promise<{ ok: true } | { error: CommunityError }>
  // author only; status 'removed' (moderated_at stays null → no notice);
  // deletes the bucket file if any

togglePostLike(id: string): Promise<{ ok: true; liked: boolean; likes: number } | { error: CommunityError }>
  // insert … on conflict do nothing / delete; read like_count back

listPostComments(postId: string):
  Promise<{ ok: true; comments: { id: string; name: string; body: string; createdAt: string; pending: boolean; mine: boolean }[] } | { error: CommunityError }>
  // approved ones + the caller's own pending ones; never emails or user ids

addPostComment(input: { postId: string; body: string }):
  Promise<{ ok: true; id: string; pending: boolean } | { error: CommunityError }>
  // status 'approved' if the commenter is an onboarded artist, else 'pending'
  // author_name = await authorName(user); author_email = user.email

reportPost(input: { postId: string; reason?: string }): Promise<{ ok: true } | { error: CommunityError }>
  // insert … on conflict do nothing (one per person)
```

La UI cuenta con que las publicaciones nuevas tardan hasta 60 s en aparecer en el feed cacheado. Por eso el autor agrega la suya al principio de la lista local apenas recibe `ok`. Un me gusta también se actualiza en pantalla de forma optimista.

---

## 10. Panel admin

Ruta `/admin/publicaciones`, que queda protegida por `app/[locale]/(site)/admin/layout.tsx`. Se agrega a `components/admin/admin-sections.ts`.

- **Pestañas**: «Para revisar» (`pending`), «Denunciadas» (`report_count > 0`, ordenadas por denuncias), «Publicadas» y «Ocultas».
- **Cada fila**: imagen, autor (nombre y email, que solo ve el admin), texto, fecha y denuncias con sus motivos.
- **Acciones**:
  - Aprobar: `pending` o `hidden` → `published`, con `report_count = 0`.
  - Ocultar: → `hidden`.
  - Borrar: → `removed` y se borra el archivo.
  - Cada acción pone `moderated_at = now()`.
- Las acciones, en `actions.ts`, verifican `ADMIN_EMAILS` con el email, como `app/[locale]/(site)/admin/obras/actions.ts`.
- Los comentarios de Comunidad pendientes aparecen en `/admin/comentarios`, con el rótulo «Comunidad» y link a la publicación, y con las mismas acciones de aprobar y rechazar.

---

## 11. Medición

En `lib/funnel.ts`, un grupo nuevo `COMMUNITY_EVENTS` que se muestra en `/admin/estadisticas` como los otros grupos. Si `FunnelEvent` es una unión derivada de esas listas, agregarlo ahí.

| Evento | Cuándo |
|---|---|
| `community_strip_view` | La franja del inicio entró en pantalla con contenido |
| `community_view` | Se abrió `/comunidad` |
| `community_post_open` | Se tocó una publicación (imagen o «ver más») |
| `community_publish_offer_view` | Se mostró la oferta «Publicala en el Mundial» |
| `community_publish_artwork` | Publicó su obra |
| `community_publish_souvenir` | Publicó un souvenir |
| `community_publish_photo` | Mandó una foto libre |
| `community_like` | Dio me gusta |
| `community_comment` | Comentó |
| `community_report` | Denunció |
| `community_to_obra` / `community_to_profile` | Clics de una publicación a la obra o al perfil |

Indicadores a mostrar en `/admin/estadisticas`, en una pestaña o sección «Comunidad», con consultas en vivo a la base y sin números fijos:

- Publicaciones por semana, por tipo.
- Porcentaje de artistas inscriptos que publicaron al menos una vez.
- Me gusta y comentarios promedio por publicación.
- Conversión de la oferta: `community_publish_artwork / community_publish_offer_view`.
- Artistas que vuelven en 7 días (si ya hay un dato de retorno; si no, dejarlo anotado como pendiente).

---

## 12. Pruebas

### SQL con PGlite: `scripts/pglite/community.mjs`

Copiar la estructura de `hide-unreadable-obra.mjs`: `boot()`, `applyMigrations(db, '<archivo nuevo>')`, crear usuarios, perfiles y obras, aplicar la migración **dos veces** y verificar:

1. Un artista publica su obra → `community_feed()` la devuelve. La segunda publicación de la misma obra falla por el índice único.
2. Una publicación de un perfil con `is_public = false` no sale en el feed. Una obra archivada tampoco.
3. Un me gusta de otra persona suma `like_count` y crea `post_activity` para el autor. Un segundo me gusta del mismo día actualiza la misma fila (`likes = 2`). El autor dándose me gusta a sí mismo no notifica. Quitar el me gusta resta.
4. Un comentario `approved` suma `comment_count`. Uno `pending` no suma y avisa a los admins. Aprobarlo suma y avisa a quien comentó. Rechazar uno aprobado resta.
5. Tres denuncias de personas distintas → `status = 'hidden'`. La cuarta de la misma persona no inserta.
6. La sexta publicación en 24 h falla con `rate_limited`. Un admin no tiene límite.
7. Cursor: con 25 publicaciones, la página 1 trae 20 y la 2 trae 5, sin repetir.
8. Una foto `pending` no sale en el feed. Al pasar a `published` sale y se avisa al autor.

Correr con `npm install --no-save @electric-sql/pglite && node scripts/pglite/community.mjs`.

### Vitest

- `lib/community.test.ts`: cursor (ida y vuelta, valores inválidos), `cleanBody` (recorta espacios, rechaza textos largos, acepta texto vacío en publicaciones), `isOwnPostPath` (rechaza `../`, carpeta ajena y extensión no permitida).
- `app/api/comunidad/route.test.ts`: con el cliente admin simulado (mock), responde con `s-maxage`, arma `next` correctamente y devuelve 400 con cursor inválido.
- Actions: mockear `createClient` y `createAdminClient` (ver cómo lo hacen los tests existentes de actions del repo) y probar los códigos `signin`, `not_artist`, `already`, `rate_limited` y `bad_image`.
- `lib/static-pages.test.ts` pasa con `/comunidad` agregado.
- `lib/i18n/messages.test.ts` pasa con las claves nuevas en los 9 idiomas.

### A mano (una vez por etapa)

- `npx next build`: `/[locale]/anon/comunidad` en `●`, y la home `anon` sigue en `●`.
- `npx next start` y, dos veces, `curl -s -D - -o /dev/null http://localhost:3000/api/comunidad`: debe traer `cache-control` con `s-maxage`. En producción, la segunda respuesta debe traer `x-vercel-cache: HIT`. Eso lo comprueba el dueño después del push.
- En el navegador, con sesión de artista: publicar la obra desde la oferta, verla en `/comunidad`, darle me gusta desde otra cuenta y ver la campanita.
- Un admin puede usar «Ver como artista» (menú de la cuenta) para probar el flujo de artista.

---

## 13. Textos (bloque `community` en `lib/i18n/messages/es.ts`)

Los otros 8 idiomas llevan las mismas claves traducidas, con el tono informal de cada idioma.

```ts
community: {
  title: 'Comunidad',
  metaDescription: 'Lo que publican los artistas del Mundial de Collage: obras, recorridos y procesos.',
  stripTitle: 'Lo que comparten los artistas',
  seeAll: 'Ver todo',
  composePrompt: '¿Qué estás haciendo? Publicá',
  bodyPlaceholder: 'Contá algo (opcional)',
  publish: 'Publicar',
  publishing: 'Publicando…',
  offerTitle: '¿La publicamos también en el Mundial?',
  offerBody: 'Tus colegas la van a ver en el inicio.',
  offerDone: '¡Listo! Ya está en Comunidad',
  offerAlready: 'Ya está en Comunidad',
  offerPending: 'Cuando aprobemos tu obra vas a poder publicarla en Comunidad.',
  viewPost: 'Ver publicación',
  publishSouvenir: 'Publicar en el Mundial',
  photoPending: 'Tu foto está en revisión. Te avisamos cuando se publique.',
  inReview: 'En revisión',
  like: 'Me gusta',
  likes: '{count} me gusta',
  comments: 'Comentarios',
  commentPlaceholder: 'Escribí un comentario',
  send: 'Enviar',
  commentPending: 'Tu comentario se publica cuando lo revisemos.',
  share: 'Compartir',
  report: 'Denunciar',
  reportReason: '¿Qué pasa con esta publicación? (opcional)',
  reported: 'Gracias, lo vamos a revisar.',
  delete: 'Borrar',
  deleteConfirm: '¿Borrar esta publicación?',
  newPosts: 'Hay publicaciones nuevas',
  empty: 'Todavía no hay publicaciones.',
  photoOf: 'Foto de {name}',
  seeMore: 'ver más',
  artistPosts: 'Publicaciones',
  errors: {
    signin: 'Ingresá con Google para seguir.',
    not_artist: 'Publicar es para artistas inscriptos. Podés dar me gusta y comentar.',
    not_found: 'Esta publicación ya no está.',
    already: 'Esta obra ya está en Comunidad.',
    rate_limited: 'Llegaste al límite por hoy. Probá más tarde.',
    too_long: 'El texto es muy largo.',
    bad_image: 'No pudimos subir la imagen. Probá con otra.',
    unavailable: 'No pudimos hacerlo ahora. Probá de nuevo en un rato.',
  },
},
```

---

## 14. Etapas, con criterios de aceptación

Cada punto es **un commit propio**. Al terminar cada etapa se corre la verificación completa (§0 y §12) y se avisa al dueño. **No pushear.**

### Etapa 1: base y el paso de Instagram

1. `feat(comunidad): add the posts, likes, comments and reports tables` (migración y `scripts/pglite/community.mjs` pasando).
2. `feat(comunidad): serve the feed from a CDN-cached endpoint` (`lib/community.ts`, `lib/community-server.ts`, `app/api/comunidad/*` y sus tests).
3. `feat(comunidad): let artists like and post their obra` (actions `communityViewer`, `publishArtwork`, `togglePostLike` y `deletePost`, con tests).
4. `feat(comunidad): add the Comunidad page` (página, copia `anon`, `STATIC_PAGES`, sitemap, `community-feed` y `post-card`).
5. `feat(comunidad): show the artists' latest posts on the home` (`community-strip` en la home).
6. `feat(share): offer to post the obra on Comunidad next to the story image` (`publish-artwork-offer`, `ShareLinks` y `ShareArtwork`).
7. `feat(admin): moderate Comunidad posts` (`/admin/publicaciones` y su sección en el menú).
8. `feat(comunidad): notify artists of likes on their posts` (registry: `post_activity`, `post_hidden`, `post_reported`, `posts_pending`).
9. `feat(stats): track Comunidad` (eventos y sección en estadísticas).

**Criterios de aceptación:**

- Un artista con obra publicada ve la oferta después de tocar «Imagen para historias» y publica en un toque.
- La publicación aparece en `/comunidad` y, con 6 o más publicaciones, en la franja del inicio.
- Un visitante sin sesión ve el feed. Al tocar «Me gusta» se le pide ingresar.
- Un me gusta llega como notificación agrupada al autor.
- El admin oculta una publicación y desaparece del feed en menos de 60 s.
- `next build` muestra las rutas `anon` en `●`, y `/api/comunidad` responde con `s-maxage`.
- El inicio no hace ninguna consulta nueva a la base en el servidor.

### Etapa 2: conversación

1. Comentarios: `listPostComments`, `addPostComment`, `comments-sheet` y moderación dentro de `/admin/comentarios`.
2. Denuncias: `reportPost` y su menú.
3. Souvenir publicable desde la galería 3D.
4. Sección «Publicaciones» en el perfil del artista.
5. Actividad de Comunidad en el mail diario (`lib/artist-digest.ts`): «Tu publicación sumó…» y, para quien nunca publicó, «Publicá tu obra en Comunidad (un toque)» con link a su obra.
6. Notificaciones `post_comment_approved` y `post_comments_pending`.

**Criterios de aceptación:**

- Un artista comenta y el comentario aparece al instante. Un visitante comenta y queda en revisión.
- Tres denuncias ocultan la publicación y avisan al admin.
- Publicar un souvenir lo muestra en el feed.

### Etapa 3: contenido propio

1. `post-composer` con foto libre y moderación previa.
2. Actualización de Términos y Condiciones (contenido subido por usuarios, licencia no exclusiva para mostrarlo en el sitio y redes del Mundial, motivos de baja, denuncias) y de la Política de privacidad (qué se muestra públicamente). En los 9 idiomas, siguiendo cómo están hechas esas páginas. El texto legal lo revisa el dueño antes del push.

**Criterio de aceptación:** una foto libre queda «En revisión», el admin la aprueba y el autor recibe aviso.

### Etapa 4: red (solo si el dueño la pide)

- Tabla `follows (follower_id, followed_id, created_at, primary key (follower_id, followed_id))`, botón «Seguir» en el perfil y en la tarjeta, y filtro «Siguiendo». Este filtro sí es personal: va en una action, no en el endpoint cacheado.
- Menciones con `@` y notificación `post_mention`.
- Vista previa propia del link de una publicación (`opengraph-image`), **dibujada una vez y guardada en R2** con `lib/share-image-cache.ts`, y anotada en `lib/cost-guards.test.ts`.

---

## 15. Qué NO hacer

- No consultar el feed en el servidor dentro de la home ni de `/comunidad`. Siempre `fetch` desde el cliente a `/api/comunidad`.
- No leer `cookies()`, `headers()` ni la sesión en `/api/comunidad`.
- No usar `revalidate` ni `unstable_cache` en el feed (escrituras ISR). El CDN alcanza.
- No usar Supabase Realtime.
- No dibujar imágenes en el servidor por publicación.
- No mandar `user_id` de `auth.users`, emails ni `author_email` al navegador. En las respuestas públicas, solo `profileId` de artistas públicos.
- No convertir el texto en HTML ni en links.
- No integrar la API de Instagram.
- No tocar `components/mobile-tab-bar.tsx`.
- No pushear ni desplegar. No juntar varios temas en un commit.
- No inventar números fijos en estadísticas: todo sale de la base.

---

## 16. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Feed vacío al principio | La franja no se muestra con menos de 6 publicaciones. El mail diario invita a publicar con un toque. La oferta aparece en `onboarding/confirmado`, justo después de inscribirse. |
| Contenido inapropiado | Las fotos libres pasan por moderación previa, 3 denuncias ocultan solas y el admin puede borrar. |
| Mucha carga de moderación | La foto libre recién llega en la etapa 3. Obra y souvenir no traen imágenes nuevas. |
| CPU de Vercel | El feed sale del CDN y hay un test que vigila que el endpoint no lea la sesión. Las escrituras son una por acción, no por visita. |
| Spam | Límites en la base (trigger), solo artistas publican y el texto no admite links activos. |
| Supabase Storage | Archivos de menos de 3 MB, achicados en el navegador. Las imágenes se sirven por `/api/img` desde R2. |

---

## 17. Pendiente de confirmar con el dueño (no bloquea la etapa 1)

1. Nombre: «Comunidad», u otro («Taller abierto», «El vestuario»).
2. Si las publicaciones de miembros del Club llevan un sello.
3. Si más adelante quiere historias de 24 horas además de publicaciones.
4. El texto legal de los Términos (etapa 3).
