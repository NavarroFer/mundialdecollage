# Comunidad: qué falta

**Estado al 2026-11-11.** Documento de traspaso, no de diseño. El diseño está en `docs/red-social-explorar.md` y `docs/red-social.md` §11 ter. Acá queda qué se hizo, qué falta, en qué archivo y cómo se verifica. La publicación sigue apagada (`COMMUNITY_POSTING = false` en `lib/community.ts`).

## Lo que ya está

| Pieza | Dónde | Estado |
|---|---|---|
| Gusto por persona (`community_taste`) | `supabase/migrations/20261113140000_community_taste.sql` | Hecho |
| Etiquetas del contenido | `lib/community-tags.ts`, migración `20261113160000_obra_activity_tags.sql` | Hecho |
| Ranking en el navegador | `lib/community.ts` (`tasteScore`, `rankForTaste`, `tasteFromRows`) | Hecho |
| «Para vos» en Inicio | `components/obra-activity-feed.tsx` | Hecho |
| «Para vos» en Explorar | `components/explore-browser.tsx` | Hecho |
| Inicio con pinta de red social | `components/artist-feed-home.tsx` + feed unificado | Hecho |
| Etiquetado de obras existentes y al aprobar | `scripts/tag-artworks.mjs`, `app/[locale]/(site)/admin/obras/actions.ts` | Hecho, **falta correrlo en producción** |

El feed del inicio quedó con una sola barra: **Para vos · Recientes · Populares · Con conversación**. «Para vos» solo aparece con sesión y gusto suficiente (5 interacciones).

## Lo que falta

### 1. Artistas sugeridos

**Objetivo.** Hasta 6 artistas afines al gusto de quien mira, sin incluirse a sí mismo ni a artistas con los que ya interactuó.

- Crear `components/community/suggested-artists.tsx`.
- Agregar `suggestedArtists()` en `app/[locale]/(site)/comunidad/actions.ts`. Reusar el `community_taste()` que ya devuelve `communityViewer()`.
- Entrada: obras públicas con `tags` (`artworks` + `profiles.is_public`), agrupadas por `profile_id`.
- Puntaje: suma de pesos del gusto de las etiquetas de sus obras, con tope por artista para que uno solo no ocupe toda la lista.
- Excluir: `profile_id` propio y artistas con like o comentario previo de esta persona.
- Salida: `{ profileId, slug, name, countryCode, imageUrl }`. Nunca email ni `auth.users.id`.
- Dónde va: inicio del artista (`components/artist-feed-home.tsx`), debajo del encabezado.
- Textos: `lib/i18n/messages/*.ts` (los 9 idiomas).

**Aceptación.** Sin sesión o sin gusto no se muestra nada. Con gusto, devuelve como máximo 6 y ninguno es el propio perfil.

### 2. Obras parecidas

**Objetivo.** Que «Si te gustó esta obra» funcione con publicación apagada.

- `app/api/comunidad/parecidas/route.ts` ya lee las etiquetas de una obra, pero llama a `community_similar`, que devuelve **posts**. Falta la rama de obras.
- Opción recomendada: RPC nueva `community_similar_obras(match_tags text[], skip uuid, page_size int)` en una migración, con `security definer`, solo obras públicas/seleccionadas, orden por coincidencia de etiquetas y después por actividad. Cachear con `s-maxage=86400`.
- Alternativa sin migración: consultar `artworks` con `overlaps('tags', tags)` y puntuar en TypeScript. Sirve para pocas centenas de obras, pero no escala tanto como el SQL.
- Devolver `{ obras: [...] }` cuando el pedido trae `obra` o `slug`, y `{ posts: [...] }` cuando trae `id`.
- Actualizar `components/community/similar-posts.tsx` para renderizar las dos formas y linkear a `/obras/{slug}`.
- La ficha ya lo monta: `app/[locale]/(site)/obras/[slug]/page.tsx` (`<SimilarPosts slug={...} />`).

**Aceptación.** Una obra con etiquetas muestra hasta 6 obras parecidas, sin incluirse, también para visitantes sin cuenta.

### 3. Medición

**Objetivo.** Saber si «Para vos» supera a «Recientes».

- Agregar a `COMMUNITY_EVENTS` en `lib/funnel.ts`:
  - `community_foryou_view` — se mostró «Para vos» con contenido.
  - `community_suggestion_click` — se tocó un artista sugerido, una obra parecida o un link del mail.
- Disparar `track('community_foryou_view')` una sola vez por montaje en `components/obra-activity-feed.tsx`, cuando `sort === 'foryou'` y hay resultados.
- Usar `TrackedLink` (o `track()` en el `onClick`) en las sugerencias.
- En `app/[locale]/(site)/admin/estadisticas/page.tsx`, pasar los dos números a `CommunityStatsPanel` desde `funnelMonth`.
- En `components/admin/community-stats.tsx`, mostrar los dos valores y la comparación:
  `respuestas por vista = (community_like + community_comment) / vistas`, «Recientes» contra `community_view` y «Para vos» contra `community_foryou_view`. Sin porcentaje fijo: los números y la diferencia.

**Aceptación.** Los dos eventos aparecen en el panel y la comparación se lee sin abrir la base.

### 4. Mail diario con sugerencias

**Objetivo.** Tres obras afines en el mail «Así le fue a tu obra», sin mail extra.

- `lib/artist-digest.ts`: agregar una función que arme la línea/bloque con 3 obras (`community_taste` → etiquetas → obras públicas que no sean del destinatario), con el mismo patrón que `communityActivityLine` / `communityDigestLine` (textos en los 9 idiomas dentro del propio archivo).
- `app/api/cron/exhibition/route.ts` (`sendArtistDigests`): calcular el gusto por `profile_id` con el cliente admin y agregar el bloque al HTML antes de mandar.
- Si el gusto está vacío o la persona puso `personalize = false`, el mail sale como hoy: sin la línea.
- Links con `?ref=` para poder atribuir el clic.
- Costo: el gusto se lee en el cron, no por visita; no se llama a la IA.

**Aceptación.** Un artista con gusto recibe 3 links; uno sin gusto recibe el mail actual sin cambios.

### 5. Privacidad

**Objetivo.** Que la personalización se pueda apagar y esté explicada.

- La columna ya existe: `profiles.personalize boolean not null default true`, y `community_taste()` la respeta.
- `app/[locale]/(site)/mi-perfil/page.tsx`: incluir `personalize` en el `select` del perfil y dibujar el checkbox **«No personalizar mis sugerencias»**. Ojo: un checkbox desmarcado no viaja en el `FormData`; usar un hidden que fuerce `off` o leer la ausencia como `false`.
- `app/[locale]/(site)/mi-perfil/actions.ts` (`saveProfile`): actualizar `profiles.personalize`.
- `app/[locale]/(site)/politica-de-privacidad/page.tsx`: párrafo que explique qué se guarda (likes, comentarios, guardados, tiempo de mirada), para qué y cómo apagarlo.
- Textos nuevos en los 9 idiomas.
- Tests: `app/[locale]/(site)/mi-perfil/actions.test.ts` cubre el guardado; agregar el caso `personalize`.

**Aceptación.** Destildar y guardar deja `personalize = false`; con eso «Para vos» desaparece y el mail no sugiere.

### 6. Puesta en producción (operativo, no código)

1. Aplicar las migraciones `20261113140000_community_taste.sql` y `20261113160000_obra_activity_tags.sql`.
2. Etiquetar lo que ya existe, primero en seco:
   ```bash
   node --env-file=.env.local scripts/tag-artworks.mjs --dry-run
   node --env-file=.env.local scripts/tag-artworks.mjs --concurrency=3
   ```
   El script es idempotente: salta las obras que ya tienen etiquetas. Necesita `ANTHROPIC_API_KEY` para la corrida real.
3. Verificar en `/admin/estadisticas` que hay etiquetas y que «Para vos» aparece con una cuenta con gusto.
4. Decidir el umbral (~50 obras por semana). Si todavía no hay volumen, la pestaña se muestra igual cuando hay gusto: el interruptor `COMMUNITY_FORYOU=on` **no está implementado**, es opcional.
5. A las dos semanas, comparar `community_foryou_view` contra `community_view`. Si «Para vos» no supera a «Recientes» por 10% o más, apagar la pestaña; las etiquetas y las obras parecidas se quedan.

## Orden sugerido

1. Artistas sugeridos (depende solo de lo que ya está).
2. Obras parecidas (independiente).
3. Medición (antes de encender nada).
4. Mail diario.
5. Privacidad.
6. Etiquetado y migraciones en producción.

## Decisiones pendientes del dueño

- **Umbral:** si ~50 obras por semana es el número correcto.
- **Atención:** si el tiempo de mirada cuenta como señal o quedan solo likes, comentarios y guardados.
- **Nombres:** «Recientes» / «Para vos» o algo con más voz («Lo último» / «Para tu ojo»).
- **Alcance:** si «Artistas que te pueden gustar» incluye solo artistas con obra publicada o también perfiles sin obra.
- **Mail:** si las tres sugerencias van siempre o solo los días con novedades.
