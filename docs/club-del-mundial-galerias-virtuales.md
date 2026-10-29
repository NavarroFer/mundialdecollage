# Club del Mundial de Collage: galerías virtuales

16 de octubre de 2026 · Fer

## Resumen

El Club del Mundial de Collage es una membresía mensual que le da a cada artista su propia galería 3D, configurable y conectada con las de los demás en un mapa, junto con una economía de monedas para destrabar salas más grandes, temas con clima de taller o museo, marcos y ropa para su avatar. Cuesta $47.000 por Mercado Pago o USD 47 por PayPal, por mes.

- **Por qué un artista entra al Club:** en la galería general del Mundial hay más de 300 obras rotando en 37 lugares por día (`ensure_exhibition_today()`), así que cada obra aparece solo cuando le toca su turno en la fila diaria. En el Club, el artista tiene **su propia muestra permanente abierta las 24 horas**, con toda su serie de obras, su texto de sala y su enlace propio.
- **Se paga por tener galería y personalizarla, no por visitar:** el artista paga para que lo vean. Cada visitante que entra suma valor a su membresía, así que las visitas quedan abiertas sin exigir inicio de sesión (solo se pide cuenta de Google cuando alguien quiere dar me gusta, guardar una estampilla en su álbum, comentar o pegar en el muro). Además, no pedir sesión al entrar permite servir la galería desde el CDN de Vercel sin gastar CPU.
- **La membresía incluye monedas todos los meses:** para que el socio no sienta que le cobramos dos veces, su cuota mensual le deposita monedas cada mes en su billetera. Con esas monedas puede ir destrabando mejoras a su ritmo, o comprar packs de monedas aparte con plata si quiere todo desde el primer día.
- **Para quién:** artistas del Mundial, un público adulto de más de 30 años, en Argentina y en el exterior.

## Qué recibe un socio

Un socio recibe su galería, monedas mensuales para mejorarla, un lugar en el mapa y los datos de quién la visita.

- **Su galería 3D:** arranca con una sala inicial de **6 a 8 obras** y los 3 temas base (*Collage*, *Jardín*, *Windows 98*), cuelga sus obras en el orden que quiera, elige cómo se ven los cuadros (marcos o clavados en la pared) y escribe los textos de sala.
- **Monedas todos los meses:** cada cuota acreditada suma monedas a su billetera para destrabar salas más grandes (14 o 22 obras), temas nuevos, marcos, música y ropa para su avatar.
- **Su avatar anfitrión y su ropa:** elige entre los avatares realistas, configura su ropa y accesorios (y puede comprar prendas, telas o accesorios nuevos con monedas). Cuando el artista no está conectado, su avatar recibe a las visitas en la entrada y muestra su texto de bienvenida; cuando entra con su cuenta, pasa a manejarlo en vivo.
- **Un lugar en el mapa** de galerías, una puerta de paso entre galerías del Club y un enlace propio para compartir.
- **Integración con el Álbum de estampillas:** sus obras pasan a ser coleccionables en el Álbum de los visitantes.
- **Estadísticas de visitas:** cuántas personas entraron, cuánto miraron cada obra («Atención por obra»), cuántas guardaron sus obras como estampillas y cuántas fotos de recuerdo sacaron.
- **Presencia en vivo:** ve quién está recorriendo su galería en este momento.
- **Más adelante:** decoración libre de la sala con muebles y objetos, tipo Sims.

## Economía de monedas y mejoras

Las monedas convierten la evolución de cada galería en un juego de colección continua y suman una vía de ingresos por compras únicas sin esperar a la etapa 3.

### Cómo se consiguen las monedas

1. **Incluidas en la cuota mensual del Club (Camino A):** cada mes que el socio paga su membresía se le acredita una tanda de monedas en su cuenta. Mantener la suscripción activa le permite ahorrar para agrandar y vestir su galería.
2. **Compra directa con plata (desde el día 1):** packs de monedas de pago único por Mercado Pago o PayPal (*Pack Chico*, *Pack Mediano* con bonus y *Pack Mecenas*), tanto para socios que quieren destrabar todo rápido como para usuarios que quieren vestir su avatar.
3. **Jugando en el sitio («efecto alcancía»):** hacer acciones en el Mundial y en el Álbum —dar *Me gusta* a una obra, guardar estampillas en el Álbum, abrir fichas o completar días en el Pasaporte— regala pocas monedas. Así todos ven su contador con saldo real desde el primer día y es más fácil que compren un pack para llegar a la mejora que quieren.

### Qué se configura y qué se compra con monedas

| Mejora | Cómo arranca de base | Qué se destraba con monedas | Etapa |
| --- | --- | --- | --- |
| **Tamaño de sala (capacidad)** | **Sala Gabinete (6 a 8 obras)** incluida con el alta del Club | **Sala Clásica (14 obras)** y **Galería Doble (22 obras)** | Etapa 1 |
| **Temas con clima de taller o museo real** | *Collage*, *Jardín* y *Windows 98* | *Taller de Artista* (piso de madera manchado, mesas con recortes), *Galpón Industrial* (ladrillo y hierro), *Salón de Museo Clásico* (parquet espina de pescado, paredes bordó o verde inglés), *Callejón de Afiches* | Etapa 1 |
| **Cómo se ven los cuadros colgados** | Marco estándar del tema | Configurable por el artista (para toda la sala o por obra): marco de madera natural, marco dorado clásico, passepartout negro, o *collage suelto pegado con cinta de papel / alfileres* sin marco | Etapa 1 |
| **Ropa y accesorios del avatar** | Ropa por defecto del personaje elegido | Cambio de telas y colores de las prendas (`fabrics.ts`), accesorios sobre el esqueleto (`Bip01`: delantal de taller, boina, anteojos, *tote bag* del Mundial, café o tijeras en mano) y personajes exclusivos | Etapa 1 / 2 |
| **Música y clima sonoro** | Pista general de la galería | Pistas de ambiente para `BackgroundMusic.tsx`: *Jazz de Vernissage*, *Lluvia en el Taller*, *Ambient de Museo* | Etapa 1 / 2 |
| **Objetos y muebles de sala** | Sala despejada | Etapa 2: objetos en lugares fijos (bancos de museo, plantas, alfombras, mesa de brindis). Etapa 3: decoración libre tipo Sims | Etapa 2 / 3 |

Todo lo que un artista destraba con monedas queda guardado para siempre en su inventario (`user_gallery_inventory`), incluso si algún mes pausa su suscripción.

## Gamificación y tráfico entre galerías

Para que ninguna galería quede vacía después del primer día, el Club se engancha con el Álbum de estampillas, el Pasaporte y el muro colectivo que ya funcionan en el sitio:

- **Cupo bonus de estampillas en el Álbum:** hoy `collect_gallery_artwork_stamp` permite guardar solo **3 obras cada 12 horas** en el museo principal. Recorrer la galería de un socio del Club habilita **1 estampilla extra gratuita de esa sala** fuera del límite de las 3 generales, además de un **Sello Postal del Artista** en el `Passport.tsx` al descubrir todas sus obras.
- **Avatar anfitrión y sello «Estuve en el Vernissage»:** si un visitante entra a la galería en el mismo momento en que el artista dueño está conectado en vivo (`GalleryPresence.tsx`), ambos desbloquean el sello *«Conocí a {Artista} en vivo en su galería»*. Esto le sirve al artista para convocar inauguraciones con día y hora desde su Instagram.
- **Tablero Kraft de visitas por galería:** cada sala puede tener su propio cuadro de papel Kraft (`CollageWall.tsx`) donde los visitantes pegan un recorte o su foto polaroid (`Souvenir.tsx`) dedicada al artista, moderado por el propio dueño de la sala.
- **Puerta al Club (paso continuo entre salas):** en cada galería hay una puerta que lleva a la siguiente galería activa del Club, y en la Galería 3D principal del Mundial se suma un acceso destacado hacia las salas de los socios.
- **Botón de consulta directa:** en la ficha de cada cuadro, el socio puede activar un botón *«Consultar al artista por esta obra»* (WhatsApp o mail) para vender sin comisiones.

## Etapas

El Club arranca por la galería de cada socio y la economía de monedas; el mapa y la decoración libre llegan después, cuando la etapa anterior cumple su puerta.

1. **Mi galería + Monedas y Mejoras + Álbum:** sala inicial de 6–8 obras y salas destrabables con monedas (14 y 22 obras), temas de taller y museo, configuración de marcos, ropa de avatar, textos de sala, enlace propio y estadísticas de visitas.
   - Puerta 1: los primeros socios usan, personalizan y comparten su galería.
2. **Mapa de galerías y objetos de sala:** cada galería es un punto del mapa, se pasa de una a otra, visitantes en vivo, un lugar destacado y primeros objetos decorativos en sala.
   - Puerta 2: hay galerías suficientes para llenar el mapa.
3. **Decoración libre:** muebles y objetos en grilla libre, paredes y pisos a gusto, decoración tipo Sims.

Así el mapa no se lanza vacío, y el editor tipo Sims, que es el trabajo más grande, llega cuando ya hay socios que lo piden, mientras las monedas ya sirven desde el día 1 para salas, temas, marcos y ropa.

## Qué se reutiliza y qué falta

Casi todo lo que necesita la primera etapa ya existe en el sitio. Lo nuevo es pasar de una galería para todos a una por artista, el editor y la billetera de monedas.

| Pieza | Ya existe | Hay que construir |
| --- | --- | --- |
| Motor 3D y salas | Salas, cámara, caminata y obras colgadas (`components/gallery`, `data/artworks.ts`) | Plantillas de sala de 6–8, 14 y 22 obras en `roomsData.ts`, y variantes de marco en `Artwork.tsx` |
| Temas | 3 temas en `components/gallery/themes.ts` (Collage, Windows 98, Jardín) | Temas nuevos de *Taller*, *Galpón Industrial*, *Museo Clásico* y *Callejón* desbloqueables con monedas |
| Editor | Nada | Elegir sala, tema, estilo de cuadros y ropa de avatar; ordenar obras; escribir textos; tienda de monedas |
| Avatares y ropa | 18 avatares realistas (`cast.ts`, `AvatarBody.tsx` con esqueleto compartido `Bip01`) y 11 telas procedurales en `fabrics.ts` + prendas en `looks.ts` | Selector de ropa/telas sobre los materiales del avatar y accesorios enganchados a los huesos de `Bip01` |
| Álbum y monedas | `stamp-album-client.tsx`, `Passport.tsx`, `ArtworkStamp.tsx`, `ArtworkLike.tsx` | Dar monedas al dar like o sumar estampillas; cupo de 1 estampilla bonus por galería del Club; tablas `club_wallets`, `coin_transactions` y `user_gallery_inventory` |
| Visitantes en vivo | Supabase Realtime, hasta 8 avatares a la vez (`GalleryPresence.tsx`) | Un canal por galería (`gallery:club:<slug>`) y NPC del artista cuando no está conectado |
| Mapa | Mapa mundial del sitio (`world-map`) | Las galerías como puntos y el paso de una a otra (Etapa 2) |
| Cobro mensual y packs | Suscripciones con Mercado Pago y planes/órdenes de PayPal (`lib/payments/`) | El plan mensual del Club (que acredita monedas y activa la galería) y los packs de monedas de compra única (`monedas:`) |
| Estadísticas | «Atención por obra» en el panel de admin (`AttentionRecorder.tsx`) | Una vista por socio, solo de las obras de su galería |

La configuración de cada galería es un registro chico en Supabase; el dibujo sigue en el navegador del visitante, así que el costo por visita no cambia.

## Costos y punto de equilibrio

Con unos USD 45 fijos por mes, dos socios ya cubren los planes pagos y las comisiones, y la venta de packs de monedas no tiene costo de envío ni de servidor. El primer costo es obligatorio: el plan Hobby de Vercel no admite uso comercial, y cobrar una membresía o vender monedas lo es.

| Concepto | Cuándo empieza | Costo por mes |
| --- | --- | --- |
| Vercel Pro | Con el primer socio | USD 20 por integrante del equipo (aprox.) |
| Supabase Pro | Cuando la base, los archivos o Realtime pasen el plan gratis | USD 25 (aprox.) |
| Cloudflare R2 | Ya en uso | USD 0 hasta 10 GB y 10 millones de lecturas; la salida de datos es gratis |
| Mercado Pago y PayPal | En cada cobro | Un porcentaje de cada cuota o pack de monedas, a confirmar |

Los montos de Vercel y Supabase son aproximados y hay que confirmarlos en sus páginas de precios. Fuentes: [precios de R2](https://developers.cloudflare.com/r2/pricing), [límites de Vercel Hobby y Pro](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing).

## Cobro y precio

El cobro usa las mismas suscripciones y compras únicas que ya funcionan en la tienda: Mercado Pago en pesos y PayPal en dólares.

- **Pesos (suscripción Club):** $47.000 por mes con Mercado Pago. Con inflación, ese monto pierde valor mes a mes; hay que fijar cada cuánto se ajusta y avisar al socio antes.
- **Dólares (suscripción Club):** USD 47 por mes con un plan de PayPal, para socios del exterior.
- **Packs de monedas (compra única):** disponibles en pesos (Mercado Pago Checkout Pro) y en dólares (PayPal Orders).
- **Plan anual:** opcional, con descuento; adelanta caja y baja las bajas.
- **Alta:** al confirmarse el primer pago se crea la galería con la sala inicial (6–8 obras), se acreditan las monedas de bienvenida del mes y se abre el editor.
- **Baja o pago rechazado:** la galería sale del mapa y queda en pausa (`status = 'paused'`), sin borrarse ni perder las salas, temas, ropa ni monedas compradas, para que vuelva intacta si el socio paga de nuevo.

## Decisiones cerradas y puntos abiertos

Decisiones ya definidas:

- [x] **Modelo de membresía y monedas (Camino A):** la cuota mensual de $47.000 / USD 47 mantiene activa la galería e incluye un depósito mensual de monedas; además se venden packs de monedas con plata.
- [x] **Ganar monedas por actividad:** dar *Me gusta* y coleccionar estampillas en el Álbum otorga pequeñas cantidades de monedas para activar el «efecto alcancía».
- [x] **Capacidad de salas:** la galería arranca con una sala para **6 u 8 obras**, y con monedas se destraban salas más grandes (14 y 22 obras).
- [x] **Temas desbloqueables:** sumar temas con climas de *Taller de Artista* y *Museo Real* comprables con monedas.
- [x] **Montaje de cuadros configurable:** el artista elige cómo se ven colgados sus cuadros (distintos marcos o pegados/clavados sin marco).
- [x] **Ropa de avatar elegible y comprable con monedas:** personalización de prendas, telas y accesorios para el avatar.

Puntos operativos por confirmar antes de lanzar:

- [ ] Definir la tabla exacta de precios de los packs de monedas y cuántas monedas regala cada cuota mensual y cada acción (like / estampilla).
- [ ] ¿Cada cuánto se ajusta el precio en pesos de la suscripción en Mercado Pago?
- [ ] ¿Hay plan anual de entrada, y con qué descuento (ej. 10 meses por 12)?

Riesgos a cuidar:

- **Mapa vacío:** con pocas galerías, recorrer el mapa decepciona. Por eso el mapa abre en la etapa 2, cuando ya hay galerías, y en la etapa 1 se conecta una galería con otra mediante la «Puerta al Club».
- **Equilibrio de monedas:** las monedas ganadas gratis dando like o juntando estampillas tienen que alcanzar para tentar (y tal vez comprar un accesorio chico o un marco), pero los temas de museo y las ampliaciones de sala deben requerir las monedas de la membresía o comprar un pack.
- **Visitantes en vivo:** cada galería con gente usa conexiones de Realtime. El tope de 8 avatares por galería acota los mensajes, no las conexiones.
- **Alcance del editor:** la decoración libre tipo Sims es un proyecto en sí mismo; va en la etapa 3.

## Próximos pasos

1. [ ] Pasar el proyecto a Vercel Pro antes de cobrar la primera cuota o vender el primer pack de monedas.
2. [ ] Escribir y probar en PGlite la migración SQL de `club_galleries`, `club_gallery_hangings`, `club_wallets`, `coin_transactions` y `user_gallery_inventory`, más el ajuste en `record_subscription_payment`.
3. [ ] Armar las 3 plantillas de sala (6–8 obras, 14 obras y 22 obras) en `roomsData.ts`, los estilos de marco en `Artwork.tsx` y los nuevos temas de taller/museo en `themes.ts`.
4. [ ] Implementar la personalización de ropa/telas del avatar (`AvatarBody.tsx` + `fabrics.ts`) y el catálogo de ítems en `lib/gallery-catalog.ts`.
5. [ ] Construir la página pública `/[locale]/(site)/club/[slug]` (cacheada en CDN) y el editor privado `/[locale]/(site)/mi-galeria`.
6. [ ] Conectar el plan del Club y los packs de monedas en Mercado Pago y PayPal (`lib/payments/`).
7. [ ] Lanzar la etapa 1 con un grupo chico de socios fundadores.

## Anexo técnico: reglas que no se pueden romper

El sitio corre en Next.js 16 sobre Vercel, con 4 horas de CPU activa cada 30 días para todo el equipo en el plan Hobby; si se acaban, el proyecto se pausa. Cada cambio tiene que mantener bajo el costo por visita, también después de pasar a Pro.

- **Leer primero** `AGENTS.md` y `CLAUDE.md` en la raíz. Esta versión de Next.js cambia APIs: la guía vigente está en `node_modules/next/dist/docs/`.
- **Nunca dibujar imágenes por pedido** (satori `ImageResponse`, sharp): cachear lo dibujado (`lib/share-image-cache.ts`, R2 o ISR). `lib/cost-guards.test.ts` lista los permitidos.
- **Lo que es igual para todos** sale con `Cache-Control` y `s-maxage`, para que responda el CDN y no una Function. Se verifica con `curl -D -` dos veces: `x-vercel-cache: HIT`.
- **Nada de `force-dynamic`, `cookies()`, `headers()` ni sesión** donde no hace falta; preferir `revalidate`.
- **Rutas nuevas que no leen la sesión** quedan fuera del matcher de `proxy.ts`; lo controla `proxy.test.ts`.
- **Páginas públicas** viven en `app/[locale]/(site)/`. Las listadas en `lib/static-pages.ts` (como `/galeria-3d`) tienen una copia `anon/` construida de antemano: ahí la sesión se lee solo con `getCurrentUser()` o `createClient()` (`lib/supabase/server.ts`) y el idioma con `getI18n()`. Después de `next build`, las rutas `anon` muestran ●, nunca ƒ.
- **Archivos 3D y pesados** van al bucket público de R2 (`NEXT_PUBLIC_GALLERY_ASSETS_URL`), nunca por Vercel ni por `next/image`.
- **Datos que el cliente puede pedir después** (listas, mapa, búsqueda) salen de un endpoint cacheado en el CDN, no del render de la página.

## Dónde está cada pieza

Todo lo de la galería vive en `components/gallery/`; los cobros, en `lib/payments/`.

| Pieza | Archivos | Nota |
| --- | --- | --- |
| Entrada y escena | `components/gallery/Game.tsx`, `Scene.tsx`, `app/[locale]/(site)/galeria-3d/page.tsx` | La escena se monta recién al tocar ENTRAR |
| Acceso | `components/gallery/GalleryAccess.tsx` | Hoy pide iniciar sesión con Google en el museo general; en las galerías del Club la entrada es libre y se pide login solo al interactuar |
| Salas, cuadros y recorridos | `world/roomsData.ts`, `world/Rooms.tsx`, `world/visitorRoutes.ts`, `data/artworks.ts`, `artwork/Artwork.tsx` | `visitorRoutes.test.ts` controla que nadie atraviese paredes; `hang()` en `data/artworks.ts` calcula los lugares sobre cada pared |
| Temas | `components/gallery/themes.ts` | Hoy tiene Collage, Windows 98 y Jardín |
| Personas, avatares y ropa | `world/people/` (`cast.ts`, `Person.tsx`, `AvatarBody.tsx`, `fabrics.ts`, `looks.ts`) | Los 18 GLB de Rocketbox comparten el esqueleto `Bip01`; `fabrics.ts` genera 11 texturas de tela en el navegador |
| Generar avatares | `scripts/avatars/build.mjs`, `scripts/avatars/page.ts` | Convierte desde Rocketbox; la carpeta `avatars/` resultante se sube a la raíz del bucket R2 |
| Álbum, likes y pasaporte | `components/stamp-album-client.tsx`, `gallery/ui/Passport.tsx`, `gallery/ui/ArtworkStamp.tsx`, `gallery/ui/ArtworkLike.tsx`, `app/[locale]/(site)/galeria-3d/actions.ts`, `supabase/migrations/20260930190000_artwork_stamp_collections.sql` | Hoy `collect_gallery_artwork_stamp` permite 3 estampillas cada 12 horas |
| Muro colectivo | `gallery/wall/CollageWall.tsx`, `supabase/migrations/20261002180000_collage_wall.sql` | Cuadro sobre papel Kraft con 3 vidas cada 8 horas |
| Presencia en vivo | `presence/protocol.ts`, `GalleryPresence.tsx`, `store.ts` | Hasta 8 avatares en vivo; se apaga con `NEXT_PUBLIC_GALLERY_LIVE=off` |
| Preferencias del visitante | `preferences/store.ts` | En el navegador; incluye el avatar elegido |
| Pantalla de inicio | `ui/StartScreen.tsx`, `ui/AvatarPicker.tsx` | |
| Cobros y tienda | `lib/store.ts`, `lib/payments/` (`provider.ts`, `providers/mercadopago.ts`, `providers/paypal.ts`, `paypal/plans.ts`, `paypal/handlers.ts`, `purchases.ts`, `references.ts`), `app/[locale]/(site)/tienda/suscribirme`, `supabase/migrations/20261001150000_mercadopago_subscriptions.sql` | Un adaptador por proveedor detrás de `PaymentProvider` |
| Mapa | `components/world-map.tsx`, `map-explorer.tsx` | |
| Estadísticas y atención | `gallery/attention/AttentionRecorder.tsx`, `components/admin/stats/`, `supabase/migrations/20261011180000_gallery_attention.sql` | «Atención por obra» mide mirada directa (> 2s a < 5m) y apertura de ficha |
| Textos | `lib/i18n/messages/*.ts` | 9 idiomas; `messages.test.ts` controla los marcadores como `{name}`; las claves las exige TypeScript, con `es.ts` como modelo |

## Propuesta técnica detallada para la etapa 1 y forma de trabajo

Guía lista para implementar paso a paso:

### 1. Modelo de datos en Supabase

- **Reutilizar `public.artworks` para las obras colgadas:** en lugar de crear una tabla paralela de obras que obligue a duplicar likes, comentarios, estampillas y medición de atención, permitir que los socios del Club suban más obras en `public.artworks` (marcadas con `is_club_only = true` cuando no son la obra que concursa en el Mundial) y referenciarlas desde `public.club_gallery_hangings (gallery_id, slot, artwork_id, frame_style, for_sale, price_label)`. Así `ArtworkLike`, `ArtworkComments`, `ArtworkStamp`, `Souvenir` y `AttentionRecorder` funcionan sin cambios.
- **`public.club_galleries`:**
  - `id uuid primary key`, `user_id uuid unique references auth.users(id)`
  - `subscription_id uuid references public.subscriptions(id)`
  - `slug text unique not null`
  - `title text not null`, `statement text`
  - `template_id text not null default 'cabinet'` (`'cabinet'` de 6–8 obras de base; `'classic'` de 14 obras y `'double'` de 22 obras desbloqueables con monedas)
  - `theme text not null default 'collage'` (los 3 base + `'atelier'`, `'industrial'`, `'museum'`, `'alley'` desbloqueables con monedas)
  - `default_frame_style text not null default 'standard'` (`'standard'` | `'wood'` | `'gold'` | `'black-mat'` | `'pinned'`)
  - `host_avatar_id text not null`, `host_outfit jsonb not null default '{}'` (colores/telas de ropa y accesorios equipados)
  - `music_track text not null default 'default'`
  - `contact_whatsapp text`, `contact_url text`
  - `status text not null default 'draft'` (`'draft'` | `'active'` | `'paused'`)
  - **RLS:** cualquiera lee las filas con `status = 'active'`; el dueño (`user_id = auth.uid()`) lee y edita la suya (una función/trigger verifica que `template_id`, `theme`, `default_frame_style` y `host_outfit` estén incluidos de base o en `user_gallery_inventory`); `service_role` actualiza `status`.
- **Billetera e inventario (`club_wallets`, `coin_transactions`, `user_gallery_inventory`):**
  - `club_wallets (user_id primary key, balance integer not null default 0 check (balance >= 0), updated_at timestamptz)`.
  - `coin_transactions (id uuid primary key, user_id uuid, delta integer not null, kind text, reference_id text, created_at timestamptz, unique (kind, reference_id))` para garantizar idempotencia ante reintentos de webhooks o acciones repetidas.
  - `user_gallery_inventory (user_id uuid, item_id text, unlocked_at timestamptz, primary key (user_id, item_id))`.
  - Función RPC `spend_coins_on_item(p_item_id text)` con `pg_advisory_xact_lock` que verifica el precio en el catálogo, descuenta de `club_wallets` e inserta en `user_gallery_inventory`.
  - En `like_gallery_artwork` y `collect_gallery_artwork_stamp`, acreditar las monedas de recompensa con tope diario por cuenta para evitar abuso.
- **Ajuste importante en `record_subscription_payment` (`20261001150000_mercadopago_subscriptions.sql` y `20260930020000_paypal_store.sql`):**
  - Hoy `record_subscription_payment` inserta siempre una fila en `public.shipments` porque asume envío postal físico. Para el plan `'club'`, hacer `shipping_address` opcional, no insertar en `shipments`, acreditar las monedas mensuales del socio en `club_wallets` y poner `club_galleries.status = 'active'`.
  - Para los packs de monedas sueltos, agregar el prefijo `monedas:` en `lib/payments/references.ts` y procesarlos con `rowPurchase` en `lib/payments/purchases.ts`.

### 2. Salas, cuadros, temas y ropa en el motor 3D

- **Plantillas de sala (`roomsData.ts` y `data/artworks.ts`):** parametrizar `rooms`, `walls`, `doorways`, `HANGINGS` y `VISITORS` por `template_id` (`cabinet` con 1 sala íntima de 6–8 obras, `classic` con 1 sala + panel central de 14 obras, `double` con 2 salas en zigzag de 22 obras), manteniendo el test de `visitorRoutes.test.ts` sobre las 3 plantillas.
- **Montaje de cuadros (`components/gallery/artwork/Artwork.tsx`):** soportar `frameStyle` por obra (`standard`, `wood`, `gold`, `black-mat`, y `pinned` sin marco exterior, con leve separación de la pared y cabezas de alfiler o cinta de papel en las esquinas).
- **Ropa del avatar (`AvatarBody.tsx` y `fabrics.ts`):** permitir reemplazar el color y `map`/`normalMap` de los materiales de prenda del GLB usando las texturas procedurales de `fabrics.ts`, y adjuntar mallas livianas de accesorios a los huesos `Bip01 Head`, `Bip01 Spine2` y `Bip01 R Hand`.

### 3. Forma de trabajo

1. **Migraciones SQL:** no hay base local; probarlas en PGlite (Postgres embebido) antes de subirlas.
2. **Antes de cada commit:** `npm test`, `npx tsc --noEmit` y `npx eslint`.
3. **Un commit por tema**, nunca varios temas juntos.
4. **Push a `main` en tandas**, una o dos veces por día: cada deploy vacía el caché del CDN. Antes de pushear, `git log origin/main..HEAD`, porque otra sesión puede estar commiteando en el mismo repo.
5. **Pruebas visuales de la galería:** el sitio pide iniciar sesión con Google en el museo general, así que conviene una página aparte o la ruta pública del Club que importe los componentes reales, como se hizo con los avatares.
