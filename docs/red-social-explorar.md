# Explorar y sugerencias: el orden personal

**Documento de diseño.** Cómo Inicio y Explorar muestran primero lo que a cada persona le gusta, sin calcular un feed distinto en el servidor. Complementa `docs/red-social.md` §11 ter (sugerencias por gusto) y §14 (etapa 4). Fecha: 2026-11-11.

---

## 1. Qué queremos

- **Inicio** con dos pestañas: «Recientes» y «Para vos». La segunda solo aparece con sesión y gusto suficiente.
- **Explorar** con los filtros que ya existen (búsqueda, país, técnica) más un orden «Para vos».
- **Sugerencias** armadas con lo que cada persona ya hizo: likes, comentarios, guardados y tiempo de mirada en la galería.
- Que todo eso **no cueste CPU ni consultas por visita**: la lista es pública y cacheada; el orden se arma en el navegador.

**Estado actual (2026-11-11).** Explorar ya existe: `app/[locale]/(site)/explorar/page.tsx` monta `components/explore-browser.tsx`, que baja `/api/obras` una vez y filtra en el navegador. Los posts de artistas están apagados (`COMMUNITY_POSTING = false` en `lib/community.ts`): el feed que se usa hoy es el de actividad de obras del inicio (`components/obra-activity-feed.tsx` contra `/api/obras/actividad`), y `/comunidad` sigue leyendo `/api/comunidad`, que no recibe publicaciones nuevas.

| Pieza | Estado |
|---|---|
| `artworks.tags`, `community_similar` | En `supabase/migrations/20261112140000_community_tags.sql` |
| Etiquetas como índices, `rankForTaste()`, `tasteFromRows()` | Hechos: `lib/community-tags.ts`, `lib/community.ts` |
| `community_taste()` y `artwork_likes.user_id` | Migración `20261113140000_community_taste.sql` (escrita; falta aplicarla) |
| Pestaña «Para vos» en Explorar | Hecha en `components/explore-browser.tsx` |
| Pestaña «Para vos» en Inicio | Hecha en `components/obra-activity-feed.tsx`; `/api/obras/actividad` manda las etiquetas con la migración `20261113160000_obra_activity_tags.sql` |
| Etiquetar las obras existentes | Corrido el 2026-11-11: 1258 de 1260 obras públicas. Quedan 2 con el archivo roto (una vacía y otra ilegible). Script `scripts/tag-artworks.mjs` y `tagArtwork()` al aprobar una obra |
| Artistas sugeridos, mail, medición | Falta |

## 2. Principio de diseño

Tres piezas baratas, en este orden:

1. **La base etiqueta el contenido una sola vez.** No hay IA por visita ni por lectura.
2. **La base calcula el gusto de una persona una vez por sesión.** `communityViewer()` es la única llamada que lo devuelve, y solo a su dueño.
3. **El navegador ordena.** Baja la misma lista que todos y la reordena con `rankForTaste()`.

Consecuencias que no se negocian:

- `/api/obras`, `/api/obras/actividad` y `/api/comunidad` devuelven **los mismos bytes para todos** (misma audiencia, en el caso del feed privado de artistas). Nada de `Vary` por usuario, cookies ni sesión en los endpoints públicos: el CDN guarda una copia por URL, no por persona.
- Ninguna consulta nueva por visita: el gusto se pide una vez al abrir la página, se guarda en estado de React y se descarta al salir. No se persiste en `localStorage`.
- La IA no participa del orden. Solo etiquetó el contenido, y podría estar apagada (`COMMUNITY_AI=off`) sin que el orden deje de funcionar (con menos etiquetas).

## 3. Señales y pesos

Todo se mide sobre **obras**, porque es lo que ya tiene interacción. Cuando los posts vuelvan, sus etiquetas se suman con la misma fórmula.

| Señal | Dónde vive | Peso | Nota |
|---|---|---|---|
| Me gusta | `artwork_likes` | 3 | Uno por persona y obra |
| Comentario aprobado | `artwork_comments` (`status = 'approved'`) | 4 | Pendientes y rechazados no cuentan |
| Guardado / sello | `artwork_stamp_collections` | 5 | La intención más fuerte; tope de 3 cada 12 h |
| Mirada en la galería | `gallery_attention` (`mode = 'view'`) | `1 × min(seg / 30, 1)` | Solo el centro de la cámara y la primera superficie |
| Ficha abierta | `gallery_attention` (`mode = 'details'`) | `1,5 × min(seg / 30, 1)` | Abrir la ficha dice más que mirar |
| Ver una tarjeta en una lista | — | 0 | Sin impresiones: no hay señal |

- **Decaimiento:** cada señal vale `peso × 0,5 ^ (días / 90)`. A los 90 días vale la mitad; a los 180, un cuarto.
- **Tope por obra:** la atención acumulada de una obra se corta en 60 segundos antes de ponderar. Una obra revisitada diez veces no puede pesar como diez obras.
- **La atención es una estimación, no una preferencia.** Así lo dice `docs/galeria-atencion.md`: no cuenta pestañas ocultas, exige 2 segundos continuos y tiene un tope de 4 horas por sesión. Por eso pesa poco y se puede apagar sin tocar el resto (ver decisiones pendientes).

## 4. Etiquetas del contenido

- El vocabulario es fijo: 40 ids en `lib/community-tags.ts` (`retrato`, `analogico`, `blanco-negro`, `taller`, `proceso`…). Nunca texto libre. Así dos obras se comparan, se traducen y se pueden sumar sin ambigüedad.
- Se guardan en `artworks.tags text[]` **una sola vez**: cuando se aprueba la obra, o con un script de una corrida para las que ya existen (`scripts/tag-artworks.mjs`, a crear). Con `COMMUNITY_POSTING = false`, `lib/community-ai.ts` solo etiqueta obras que además se publicaron: falta engancharlo en `app/[locale]/(site)/admin/obras/actions.ts` al aprobar.
- Una obra sin etiquetas no rompe nada: aporta cero al gusto y no se sugiere.
- **Viajan como índices numéricos.** `/api/obras` manda `tags: number[]` (`tagIndexes()`), no las 40 palabras: un número ocupa 1 o 2 bytes y repetir `blanco-negro` en cientos de obras engorda el JSON que el CDN guarda y el navegador baja. El cliente las recupera con `tagsFromIndexes()`; los índices desconocidos se descartan. Si los posts vuelven y su feed crece, se aplica el mismo criterio a `posts.tags`.

## 5. El gusto

`public.community_taste(visitor uuid)` devuelve `(tag text, weight double precision)` y cumple este contrato:

- **Top 10** etiquetas, ordenadas de mayor a menor peso.
- **Normalizado 0..1**: la etiqueta más fuerte vale 1 y el resto se escala contra ella. El navegador solo necesita el orden relativo.
- **Vacío** si el visitante es nulo, si tiene **menos de 5 interacciones** o si `profiles.personalize = false`.
- **Una interacción es una fila de señal, no una etiqueta.** Una obra con seis etiquetas suma una vez por el like, no seis.
- Solo lee etiquetas del vocabulario cerrado. `security definer`, `stable`, `search_path = ''`, `revoke` para `anon` y `authenticated`, `grant` solo a `service_role`, y la llama únicamente `communityViewer()` (`app/[locale]/(site)/comunidad/actions.ts`) después de verificar la sesión. Nunca un endpoint público.

SQL de referencia (resumido; el definitivo es `20261113140000_community_taste.sql`):

```sql
create or replace function public.community_taste(visitor uuid)
returns table (tag text, weight double precision)
language sql stable security definer set search_path = '' as $$
  with attention as (
    select g.artwork_id,
           sum(g.milliseconds) filter (where g.mode = 'view') as view_ms,
           sum(g.milliseconds) filter (where g.mode = 'details') as details_ms,
           max(g.updated_at) as happened_at
      from public.gallery_attention g
      join public.gallery_attention_sessions s on s.id = g.session_id
     where s.user_id = visitor group by g.artwork_id
  ),
  signals as (
    select artwork_id, 3.0 as base, created_at as happened_at from public.artwork_likes where user_id = visitor
    union all select artwork_id, 4.0, created_at from public.artwork_comments where user_id = visitor and status = 'approved'
    union all select artwork_id, 5.0, collected_at from public.artwork_stamp_collections where user_id = visitor
    -- 1 × min(seg/30, 1); la atención de una obra se corta en 60 s.
    union all select artwork_id, least(least(view_ms, 60000) / 30000.0, 1.0), happened_at from attention where view_ms is not null
    union all select artwork_id, 1.5 * least(least(details_ms, 60000) / 30000.0, 1.0), happened_at from attention where details_ms is not null
  ),
  scored as (
    select artwork_id, base * power(0.5, extract(epoch from now() - happened_at) / (90 * 86400.0)) as w
      from signals
  ),
  per_tag as (
    select t.tag, sum(sc.w) as w
      from scored sc
      join public.artworks a on a.id = sc.artwork_id
      cross join lateral unnest(a.tags) as t(tag)
     where btrim(t.tag) <> '' group by t.tag
  )
  select pt.tag, (pt.w / max(pt.w) over ())::double precision
    from per_tag pt
   where visitor is not null
     and (select count(*) from signals) >= 5
     and coalesce((select p.personalize from public.profiles p where p.id = visitor), true)
   order by 2 desc, 1 asc limit 10
$$;
```

Se prueba con PGlite (`scripts/pglite/community-taste.mjs`): menos de 5 señales devuelve vacío; lo reciente pesa más; `personalize = false` devuelve vacío; dos corridas seguidas no duplican.

## 6. El orden

`rankForTaste(items, taste)` en `lib/community.ts`, puro y sin acceso a la base:

```
score = Σ taste[etiqueta]                         // cada etiqueta una vez
      + 0,5 × likes / maxLikes
      + 0,3 × comments / maxComments
      + 0,2 × (createdAt - másViejo) / (másNuevo - másViejo)
```

- **La fijada va primera.** Es la consigna de la semana: una decisión editorial, no una preferencia. Si el orden por gusto la moviera, la consigna dejaría de existir. En Explorar no hay fijadas, así que manda el puntaje.
- **Sin gusto, no cambia nada.** Devuelve una copia en el mismo orden. La pestaña ni se muestra.
- **El gusto manda; la popularidad desempata.** Los pesos de etiqueta suman hasta ~6; likes, comentarios y recencia juntos no pasan de 1. Dos obras con el mismo match se ordenan por respuesta y después por fecha.
- **Empates estables:** se conserva el orden original. Nada de azar: el resultado tiene que ser reproducible y testeable. Los pesos de popularidad y recencia se calculan dentro del lote que se muestra, no contra totales globales.
- **Cada lista puntúa con lo que trae.** Explorar solo manda etiquetas, así que allí manda el match; Inicio suma likes, comentarios y usa `activityAt` como fecha. Si falta un campo, vale 0 y el orden sigue siendo válido.

## 7. Dónde se ve

| Lugar | Archivo | Qué ordena |
|---|---|---|
| Inicio del artista, pestañas «Recientes» / «Para vos» | `components/artist-feed-home.tsx`, `components/obra-activity-feed.tsx` | La lista de `/api/obras/actividad`, que ya trae `tags` como índices |
| Explorar: búsqueda, país, técnica y orden | `components/explore-browser.tsx` | La lista de `/api/obras` |
| «Artistas que te pueden gustar» | nuevo `components/community/suggested-artists.tsx` y una action | Hasta 6 artistas con etiquetas del gusto, sin incluirse a uno mismo |
| «Si te gustó esta obra» | `components/community/similar-posts.tsx`, `app/api/comunidad/parecidas/route.ts` | Parecidas por etiquetas, iguales para todos |
| Mail diario | `lib/artist-digest.ts`, `app/api/cron/exhibition/route.ts` | Tres sugerencias por persona, calculadas en el cron |

- **Inicio y Explorar.** «Para vos» solo se muestra con sesión y `taste` no vacío. En Inicio ordena las páginas ya cargadas (el feed sigue paginando por actividad), usando `activityAt` como fecha. En Explorar, los filtros se aplican antes de ordenar y «Recientes» es el orden actual.
- **Artistas sugeridos.** Se calcula al abrir la sección, no por visita. Excluye al propio artista y a quienes ya tienen una respuesta suya (like o comentario). Devuelve nombre, slug, país y una miniatura; nunca email ni `auth.users.id`.
- **Parecidas.** `s-maxage=86400`. Si recibe una obra devuelve obras; si recibe una publicación, publicaciones. Hoy solo resuelve posts (`community_similar`), así que con los posts apagados la sección en la ficha de una obra queda vacía: falta la rama de obras.
- **Mail.** Tres obras con etiquetas del gusto, con link directo y `?ref=` si corresponde. Si el gusto está vacío, el mail sale como hoy, sin la línea.

## 8. Arranque en frío y umbral

- **Menos de 5 interacciones = sin gusto.** No hay nada que leer todavía; la pestaña no se muestra y el mail no sugiere. Un visitante sin sesión nunca la ve.
- **La pestaña no se muestra hasta que haya volumen.** Con pocas obras por semana todo entra en una pantalla y ordenar no cambia nada. Umbral propuesto: **más de ~50 obras o publicaciones por semana**. Se controla con un interruptor (`COMMUNITY_FORYOU=on`) que el dueño prende después de mirar el número en `/admin/estadisticas`; no se consulta por visita.
- **Las etiquetas se guardan igual desde el día uno.** Aunque la pestaña esté apagada, `artworks.tags` se llena. El día que se prende, el gusto ya tiene historia.

## 9. Identidad y privacidad

- **`artwork_likes` está por email.** La clave es `(artwork_id, email)` y no tiene cuenta. La migración `20261113140000_community_taste.sql` agrega `user_id`, hace backfill con `lower(auth.users.email) = artwork_likes.email` y cambia `like_gallery_artwork()` para que las escrituras nuevas manden el id de la sesión verificada (`app/[locale]/(site)/galeria-3d/actions.ts`). Los likes viejos sin cuenta quedan con `user_id` nulo y no aportan al gusto: no hay forma honesta de atribuirlos.
- **El gusto es personal.** `community_taste()` es `security definer`, no se puede ejecutar desde `anon` ni `authenticated`, y solo `communityViewer()` lo devuelve a su dueño. No aparece en `/api/comunidad`, `/api/obras`, `/api/comunidad/parecidas` ni en ninguna respuesta pública. Tampoco se manda a la IA: a Anthropic solo van textos e imágenes de contenido, nunca personas ni etiquetas de una persona.
- **Interruptor y política.** `profiles.personalize boolean not null default true`; en `/mi-perfil` («Editar mis datos») va «No personalizar mis sugerencias», y con `false` la función devuelve vacío y el mail no sugiere. `app/[locale]/(site)/politica-de-privacidad` explica qué se guarda (likes, comentarios, guardados, tiempo de mirada), para qué y cómo apagarlo.
- Los eventos de medición no llevan el gusto ni el id de la persona.

## 10. Medición

Dos eventos nuevos en `COMMUNITY_EVENTS` (`lib/funnel.ts`):

| Evento | Cuándo |
|---|---|
| `community_foryou_view` | Se mostró la pestaña «Para vos» con contenido |
| `community_suggestion_click` | Se tocó un artista sugerido, una obra parecida o un link del mail |

La comparación que decide si la función queda:

```
respuestas por vista = (community_like + community_comment) / vistas
```

- «Recientes» se mide contra `community_view`; «Para vos», contra `community_foryou_view`.
- Si después de dos semanas «Para vos» no supera a «Recientes» por un margen claro (10 % o más), se apaga la pestaña. Las etiquetas y «Si te gustó esta obra» se quedan: funcionan sin gusto.
- El panel `/admin/estadisticas` muestra los dos números, no un porcentaje fijo.

## 11. Plan de trabajo en commits

Cada commit se verifica con `npx tsc --noEmit -p .`, `npx eslint <archivos>`, `npx vitest run` y, si toca SQL, PGlite. No se pushea: el dueño lo hace en lotes.

1. `feat(comunidad): compute each visitor's taste in the database`
   `supabase/migrations/20261113140000_community_taste.sql`, `scripts/pglite/community-taste.mjs`. Incluye `artwork_likes.user_id`, el backfill por email, `profiles.personalize`, `community_taste()` y la versión de tres argumentos de `like_gallery_artwork()`.
2. `feat(comunidad): rank a cached list by taste in the browser`
   `lib/community.ts` (`tasteScore`, `rankForTaste`, `tasteFromRows`), `lib/community.test.ts`, `app/[locale]/(site)/comunidad/actions.ts` (`taste` en `communityViewer`) y `app/[locale]/(site)/galeria-3d/actions.ts` (mandar el id al dar like).
3. `feat(obras): send tags with the cached listings`
   `app/api/obras/route.ts`, `app/api/obras/actividad/route.ts`, `lib/finalists.ts`, `lib/community-tags.ts`, `lib/artwork-search.ts` y una migración nueva (`..._obra_activity_tags.sql`): `obra_activity_feed` todavía no devuelve etiquetas. Viajan como índices en ambas listas.
4. `feat(comunidad): order Inicio and Explorar by taste`
   `components/obra-activity-feed.tsx`, `components/artist-feed-home.tsx`, `components/explore-browser.tsx`, `lib/i18n/messages/*.ts` (los 9 idiomas).
5. `feat(comunidad): suggest artists and similar obras`
   `components/community/suggested-artists.tsx` (nuevo), la action que lo alimenta, `components/community/similar-posts.tsx`, `app/api/comunidad/parecidas/route.ts`, `app/[locale]/(site)/obras/[slug]/page.tsx` y `app/[locale]/(site)/comunidad/p/[id]/page.tsx`.
6. `feat(comunidad): bring suggestions to the daily mail and measure them`
   `lib/artist-digest.ts`, `app/api/cron/exhibition/route.ts`, `lib/funnel.ts`, `app/[locale]/(site)/admin/estadisticas/page.tsx`, `lib/i18n/messages/*.ts`.

Antes del commit 4 hace falta etiquetar lo que ya existe: `scripts/tag-artworks.mjs` de una corrida y el enganche en `app/[locale]/(site)/admin/obras/actions.ts` al aprobar. Sin eso, «Para vos» no tiene con qué ordenar.

## 12. Qué NO hacer

- No ordenar distinto en el servidor por visitante. El CDN no puede cachear eso y la CPU de Vercel no lo aguanta.
- No llamar a la IA por visita, ni en `/api/obras`, ni en `/api/comunidad`, ni en el mail de cada día. La IA etiqueta una vez.
- No mandar emails, ids de `auth.users` ni el gusto de una persona a la IA.
- No exponer el gusto de alguien: ni en una respuesta pública, ni en un ranking de artistas, ni en un log.
- No filtrar ni reordenar el feed cacheado por persona en el endpoint.
- No agregar consultas nuevas al abrir una página ni usar `localStorage` para el gusto: es dato personal y no debe quedar en un navegador compartido.
- No inventar un orden aleatorio para «descubrir». Si no hay señal, se muestra el orden de siempre.

---

## Decisiones pendientes del dueño

1. **Umbral:** si ~50 obras por semana es el número correcto, o espera a tener más.
2. **Atención:** si el tiempo de mirada cuenta como señal (peso 1 / 1,5) o se apaga y quedan solo likes, comentarios y guardados.
3. **Nombres:** «Recientes» y «Para vos», o algo con más voz («Lo último» / «Para tu ojo»).
4. **Alcance de las sugerencias:** si «Artistas que te pueden gustar» incluye solo artistas con obra publicada o también perfiles sin obra.
5. **Mail:** si las tres sugerencias diarias van siempre o solo los días con novedades.
