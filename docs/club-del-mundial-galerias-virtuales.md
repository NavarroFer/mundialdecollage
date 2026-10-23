# Club del Mundial de Collage: galerías virtuales, gamificación y economía de monedas

16 de octubre de 2026 · Fer

## Resumen

El Club del Mundial de Collage es una membresía mensual que le da a cada artista su propia galería 3D permanente, configurable y conectada con las de los demás en un mapa interactivo. Cuesta **$47.000 por Mercado Pago** o **USD 47 por PayPal**, por mes, e incorpora un **sistema de monedas** para desbloquear nuevos temas estéticos, marcos, música ambiental, ampliaciones de sala y objetos de decoración.

- **Por qué un artista entra al Club:** en la muestra general del Mundial hay más de 300 obras rotando en 37 lugares por día (`ensure_exhibition_today()`), por lo que la obra de cada participante se exhibe solo cuando le toca en la fila diaria. En cambio, en el Club el artista tiene **su propia muestra individual abierta las 24 horas los 365 días**, con **toda su serie de obras** (no una sola), su texto curatorial y su enlace propio.
- **Se paga por tener galería y personalizarla, no por visitar:** el artista paga para que lo vean. Cada visitante que entra suma valor a su membresía, por lo que **visitar una galería del Club no exige iniciar sesión** (solo se pide cuenta de Google en el momento en que el visitante quiere guardar una estampilla en su álbum, dar me gusta o dejar su firma). Además, abrir la visita sin login permite servir la página directo desde el CDN de Vercel sin gastar CPU en cada entrada.
- **Para quién:** artistas del Mundial, un público adulto de más de 30 años, en Argentina y en el exterior.

---

## Economía de Monedas y Tienda de Mejoras para la Galería

Además de la suscripción mensual, el Club suma una **moneda virtual propia** que convierte la evolución de cada galería en un juego de colección y personalización continua, y abre una segunda vía de ingresos por microtransacciones.

### 1. Cómo se consiguen las monedas
- **Compra directa con dinero (desde el día 1):** cualquier socio (o visitante) puede comprar packs de monedas como pago único (`one_time`) con Mercado Pago o PayPal:
  - *Pack Chico* (ej. 500 monedas) — ideal para destrabar un tema o un marco especial.
  - *Pack Mediano* (ej. 1.500 monedas + 15% bonus) — ideal para equipar la sala completa.
  - *Pack Mecenas* (ej. 3.500 monedas + 30% bonus) — para coleccionar todos los temas, salas y decoraciones.
- **Recompensa por membresía activa:** cada mes que el socio paga su cuota del Club, recibe una recarga automática de monedas de regalo en su billetera (incentivo directo de retención: mantener la suscripción al día acumula monedas para seguir mejorando la sala).
- **Logros y actividad en la galería (gamificación):** el artista también gana monedas al alcanzar hitos reales en su sala (por ejemplo: primeras 50 visitas, 10 obras suyas guardadas en álbumes de visitantes, llenar su libro de visitas o realizar un vernissage en vivo).

### 2. Qué se puede comprar con monedas (de menor a mayor complejidad técnica)
Lo mejor de este esquema es que **no hace falta esperar al editor libre tipo Sims (Etapa 3) para que las monedas tengan uso inmediato desde la Etapa 1**:

| Categoría | Ejemplos de ítems desbloqueables con monedas | Etapa | Impacto técnico |
| --- | --- | --- | --- |
| **Nuevos Temas de Sala** | *Museo Nocturno (terciopelo oscuro y spots)*, *Taller de Papel Kraft*, *Hormigón Brutalista*, *Bauhaus*, *Invernadero Botánico* (además de los 3 base: Collage, Jardín, Windows 98) | **Etapa 1** | **Muy bajo:** son paletas de materiales, luces y cielo en `components/gallery/themes.ts` |
| **Marcos y Montajes** | Marco dorado clásico, caja de madera natural, passepartout negro, collage clavado con alfileres sin marco | **Etapa 1** | **Bajo:** variante del componente `Artwork.tsx` por cuadro o por sala |
| **Música y Clima Sonoro** | Nuevas pistas para `BackgroundMusic.tsx`: *Jazz de Vernissage*, *Lluvia en el Taller*, *Ambient de Museo*, *Sintetizador 98* | **Etapa 1** | **Muy bajo:** archivos de audio livianos en Cloudflare R2 |
| **Ampliaciones de Sala** | Pasar de la *Sala Clásica* (14 obras) a la *Galería Doble* (22 obras) o al *Gran Pabellón* (32 obras) | **Etapa 1 / 2** | **Bajo:** nuevas plantillas precalculadas en `roomsData.ts` |
| **Objetos de Sala (Slots fijos)** | Banco de museo en el centro, plantas en maceta en las esquinas, alfombra central, mesa de brindis con copas, cartel de neón en la entrada | **Etapa 2** | **Medio:** modelos GLB livianos en R2 que se prenden/apagan en posiciones predefinidas de la sala |
| **Decoración Libre (Tipo Sims)** | Muebles, paneles divisorios móviles, esculturas en pedestal, texturas por pared | **Etapa 3** | **Alto:** editor 3D con grilla de posicionamiento y colisiones dinámicas |

> **Nota clave sobre la baja de suscripción:** las mejoras, temas y monedas que un artista compró quedan **guardados para siempre en su inventario (`user_gallery_inventory`)**. Si algún mes pausa su membresía y vuelve más adelante, recupera su galería con todos sus temas y objetos desbloqueados.

---

## Gamificación: cómo lograr que las galerías se llenen de gente

El mayor riesgo de una galería personal es que quede como una isla solitaria después del primer día. Para que cada socio reciba visitas constantes de toda la comunidad, el Club se engancha directamente con las mecánicas de juego que ya existen en el sitio:

### 1. El Álbum de Figuritas y el «Cupo Extra del Club»
Hoy `collect_gallery_artwork_stamp` (`20260930190000_artwork_stamp_collections.sql`) permite guardar solo **3 estampillas cada 12 horas** en el museo principal. Esa escasez hace que cada figurita valga.
- **Plancha propia en el Álbum:** cada socio del Club tiene su propia sección/página dentro del Álbum del Mundial con las obras de su galería.
- **Estampilla bonus por galería visitada:** visitar la galería de un socio permite coleccionar **1 obra de esa sala fuera del límite de 3 cada 12 horas** del museo general. Esto les da a los coleccionistas un motivo diario para salir a recorrer galerías de socios mientras esperan que se recargue su cupo del museo principal.
- **Sello Postal del Artista:** al descubrir todas las obras de la sala de un socio (en el `Passport.tsx`), el visitante destraba el **Sello Postal exclusivo de esa galería** (con el nombre del artista, su país y la fecha).

### 2. El Avatar Anfitrión (NPC cuando no está, En Vivo cuando entra)
La galería ya cuenta con avatares que caminan rutas (`visitorRoutes.ts`) y presencia en tiempo real (`GalleryPresence.tsx`).
- **Cuando el artista no está conectado:** su avatar elegido (`avatar_id`) actúa como **anfitrión en la entrada de su sala**, con una placa con su nombre. Si el visitante se acerca y presiona `E` sobre el avatar del artista, se abre la **Carta de Bienvenida del Artista** (su bio, su declaración curatorial y sus redes).
- **Cuando el artista entra a su propia galería (`user.id === gallery.user_id`):** el NPC desaparece y el artista toma el control en vivo de su avatar, identificado con un distintivo sobre la cabeza («Artista en sala»).
- **Medalla «Estuve en el Vernissage»:** si un visitante coincide en tiempo real con el artista dentro de su sala, ambos desbloquean automáticamente un sello especial: *«Conocí a {Artista} en vivo en su galería»*. Cuando el socio anuncia en su Instagram *"Hoy a las 20 hs estoy en mi galería 3D recibiendo visitas"*, sus seguidores entran porque ese sello solo se consigue con el artista conectado.

### 3. El Tablero Kraft de Visitas (reutilizando `CollageWall.tsx`)
En vez de un libro de visitas de texto plano, cada galería del Club reutiliza la mecánica del **Collage Colectivo** (`components/gallery/wall/CollageWall.tsx`):
- En una pared de la sala del socio hay un **tablero de papel Kraft (`#cdb38c`)** propio de esa galería.
- Los visitantes apuntan con la mira (`WallAim`), eligen dónde pegar su recorte o su postal souvenir (`Souvenir.tsx`) y dejan un saludo corto.
- El socio modera las pegatinas de su propio muro desde su editor con un clic (igual que hoy funciona `/admin/muro`), y ve cómo el tablero de su galería se va llenando de recortes de quienes lo visitaron.

### 4. La «Puerta al Club» (tráfico cruzado continuo)
Para que los visitantes de un socio pasen a los demás socios:
- En la última pared de cada galería hay una **Puerta / Pasaje del Club** con una placa 3D (`Plaque`) que anuncia al próximo artista («Siguiente sala: {Artista} · {País}»).
- Al cruzarla o apretar `E`, el visitante salta directamente a la galería de otro socio activo (priorizando galerías donde haya gente en vivo en ese momento o que el visitante todavía no haya sellado en su pasaporte).
- En la **Galería 3D principal del Mundial** también se agrega una puerta destacada: *«Pasaje al Club: visitá las salas de los artistas»*, derivando tráfico diario del museo principal hacia los socios.

### 5. Estadísticas que justifican la cuota y botón de consulta directa
Reutilizando `AttentionRecorder.tsx` (`docs/galeria-atencion.md`):
- **Atención real medida con raycast:** el socio ve en su panel cuántas personas entraron, cuántos segundos miraron cada cuadro de frente (`view` > 2s a menos de 5m) y cuántas veces abrieron cada ficha (`details`).
- **Impacto en el Álbum:** ve cuántas personas guardaron cada una de sus obras como figurita en su álbum y cuántas postales souvenir (`Souvenir.tsx`) se sacaron frente a sus cuadros.
- **Notificaciones semanales:** usando el sistema de `user_notifications`, cada socio recibe su resumen: *«Esta semana 42 personas recorrieron tu galería y guardaron 19 estampillas de tus obras»*.
- **Consulta por obra (Showroom):** cada ficha de obra puede mostrar opcionalmente un botón *«Consultar al artista por esta obra»* (WhatsApp o mail), sin intermediación ni comisión del sitio.

---

## Etapas y puertas de avance

El Club arranca por la galería de cada socio y la tienda de temas/monedas; el mapa y la decoración libre llegan después, cuando la etapa anterior cumple su puerta.

1. **Etapa 1 — Mi galería + Monedas y Temas + Álbum:**
   - Sala elegida entre plantillas, tema (3 base + temas premium desbloqueables con monedas), marcos, obras en orden, textos de sala y avatar anfitrión.
   - Compra de packs de monedas con Mercado Pago y PayPal + monedas ganadas por actividad.
   - Visita abierta sin login obligatorio (login solo al coleccionar estampilla, dar like o pegar en el muro).
   - Integración con el Álbum de estampillas, el Pasaporte, la Puerta a la siguiente galería y el panel de «Atención por obra» para el socio.
   - **Puerta 1:** los primeros socios fundadores arman, personalizan y comparten su galería.
2. **Etapa 2 — Mapa de galerías, Objetos de sala y Vernissages programados:**
   - Cada galería activa aparece como un punto en el mapa mundial (`world-map`), se pasa de una a otra, muestra cuánta gente hay adentro en vivo y destaca las salas con inauguración del día.
   - Objetos decorativos pre-posicionados comprables con monedas (bancos, plantas, alfombras, mesa de brindis).
   - **Puerta 2:** hay galerías suficientes para que el mapa se vea vivo en varios países.
3. **Etapa 3 — Decoración libre (estilo Sims):**
   - Muebles y objetos en grilla libre, paneles móviles, paredes y pisos a gusto.

---

## Qué se reutiliza y qué falta construir

| Pieza | Ya existe en el código | Qué hay que construir |
| --- | --- | --- |
| **Motor 3D y salas** | `components/gallery/Game.tsx`, `Scene.tsx`, `world/roomsData.ts`, `world/Rooms.tsx`, `data/artworks.ts` (`hang()`) | Convertir `roomsData.ts` y `HANGINGS` en **3 plantillas de sala** elegibles (Gabinete de 8 obras, Sala Clásica de 14 obras, Galería Doble de 22 obras) con sus rutas en `visitorRoutes.ts` verificadas por `visitorRoutes.test.ts` |
| **Temas y Tienda de Mejoras** | `components/gallery/themes.ts` (Collage, Windows 98, Jardín), `BackgroundMusic.tsx`, `Artwork.tsx` | Sumar temas premium en `themes.ts`, estilos de marco en `Artwork.tsx` y el catálogo de ítems canjeables con monedas (`lib/gallery-catalog.ts`) |
| **Billetera de Monedas** | Pagos únicos en `lib/payments/` (`orders`, `purchases.ts`, Mercado Pago Checkout Pro y PayPal Orders) | Tablas `club_wallets`, `coin_transactions` y `user_gallery_inventory`, compra de packs de monedas (`coin_pack`) y función RPC `spend_coins_on_gallery_item` |
| **Acceso y CDN** | `app/[locale]/(site)/galeria-3d/page.tsx` (hoy usa `force-dynamic` porque exige login al entrar) | Ruta `/[locale]/(site)/club/[slug]` **sin login para entrar**, estática con `revalidate` y copia `anon/`, pidiendo Google solo al interactuar (`ArtworkStamp.tsx`, `ArtworkLike.tsx`) |
| **Avatar anfitrión y vivo** | 18 avatares en `world/people/cast.ts`, `AvatarPicker.tsx` y `GalleryPresence.tsx` (hasta 8 en vivo) | Canal Realtime por galería (`gallery:club:<slug>`), NPC del artista cuando no está conectado y medalla al coincidir en vivo con el dueño |
| **Álbum y Pasaporte** | `components/stamp-album-client.tsx`, `Passport.tsx`, `ArtworkStamp.tsx`, `collect_gallery_artwork_stamp` | Extender la colección de estampillas a las obras del Club (con 1 cupo bonus por galería) y el sello postal del artista al completar su sala |
| **Muro de visitas** | `components/gallery/wall/CollageWall.tsx` (`20261002180000_collage_wall.sql`) | Instanciar el cuadro Kraft por `gallery_id`, moderado por el propio socio dueño de la sala |
| **Estadísticas** | `AttentionRecorder.tsx`, `20261011180000_gallery_attention.sql` y `components/admin/stats/attention-ranking.tsx` | Vista/RPC para que el dueño lea las métricas de atención y estampillas de sus propias obras |
| **Editor del socio** | Subida a R2 y formularios de obras en `/onboarding/obras` | Página privada `/mi-galeria` para elegir plantilla, tema, marcos, tienda de monedas, avatar, textos y ordenar sus obras |
| **Cobro mensual** | `lib/store.ts`, `lib/payments/paypal/handlers.ts`, `20261001150000_mercadopago_subscriptions.sql` | Agregar el plan `club` ($47.000 ARS / USD 47), ajustar `record_subscription_payment` para que **no cree envíos físicos en `shipments`** cuando el plan es digital, acreditar las monedas mensuales del socio y sincronizar `subscriptions.status` con `club_galleries.status` (`active` / `paused`) |

---

## Diseño de datos en Supabase (Etapa 1)

Aprovecha las tablas existentes (`profiles`, `artworks`, `subscriptions`, `orders`, `gallery_attention_events`) y suma lo propio del Club y la economía de monedas:

1. **`public.club_galleries`**
   - `id uuid primary key`, `user_id uuid unique references auth.users(id)`
   - `subscription_id uuid references public.subscriptions(id)`
   - `slug text unique not null` (por defecto el slug del perfil del artista)
   - `title text not null`, `statement text` (texto curatorial / bienvenida del avatar)
   - `template_id text not null default 'classic'` (`'cabinet'` 8 obras | `'classic'` 14 obras | `'double'` 22 obras)
   - `theme text not null default 'collage'` (temas gratuitos o desbloqueados en `user_gallery_inventory`)
   - `frame_style text not null default 'standard'` (`'standard'` | `'gold'` | `'wood'` | `'pin'` | `'black'`)
   - `music_track text not null default 'default'`
   - `equipped_items text[] not null default '{}'` (objetos decorativos activos en la sala)
   - `host_avatar_id text not null` (uno de los 18 de `cast.ts`)
   - `contact_whatsapp text`, `contact_url text`
   - `status text not null default 'draft'` (`'draft'` | `'active'` | `'paused'`)
   - **RLS:** cualquiera (`anon`, `authenticated`) lee filas con `status = 'active'`; el dueño (`user_id = auth.uid()`) lee y edita la suya (verificando que `theme`, `frame_style` y `equipped_items` estén en su inventario); `service_role` cambia `status` según los pagos de la suscripción.

2. **`public.club_gallery_hangings`**
   - `gallery_id uuid references public.club_galleries(id) on delete cascade`
   - `slot smallint not null` (0..N según la plantilla)
   - `artwork_id uuid references public.artworks(id) on delete cascade` (reutilizando la tabla `artworks` para que likes, comentarios, estampillas del álbum y `gallery_attention` funcionen automáticamente sin duplicar tablas!)
   - `for_sale boolean not null default false`, `price_label text`
   - `primary key (gallery_id, slot)`, `unique (gallery_id, artwork_id)`

3. **Billetera, Monedas e Inventario (`club_wallets`, `coin_transactions`, `user_gallery_inventory`)**
   - **`public.club_wallets`**:
     - `user_id uuid primary key references auth.users(id) on delete cascade`
     - `balance integer not null default 0 check (balance >= 0)`
     - `updated_at timestamptz not null default now()`
   - **`public.coin_transactions`** (libro mayor inmutable para auditoría):
     - `id uuid primary key default gen_random_uuid()`
     - `user_id uuid not null references auth.users(id) on delete cascade`
     - `delta integer not null` (positivo al comprar pack o recibir premio; negativo al canjear una mejora)
     - `kind text not null check (kind in ('purchase', 'subscription_bonus', 'achievement', 'spend', 'refund'))`
     - `reference_id text` (ID del pago en `payments`/`entry_purchases` o ID del ítem comprado, con `unique (kind, reference_id)` para idempotencia ante reintentos de webhooks)
     - `created_at timestamptz not null default now()`
   - **`public.user_gallery_inventory`**:
     - `user_id uuid not null references auth.users(id) on delete cascade`
     - `item_id text not null` (ej. `'theme:velvet-night'`, `'frame:gold'`, `'template:double'`, `'prop:museum-bench'`)
     - `unlocked_at timestamptz not null default now()`
     - `primary key (user_id, item_id)`
   - **Seguridad y RLS:** el cliente solo tiene `select` sobre su billetera e inventario. Las cargas de monedas las ejecuta exclusivamente el servidor (`service_role`) al confirmar el pago en Mercado Pago o PayPal; el gasto de monedas ocurre únicamente mediante la función RPC `spend_coins_on_gallery_item(p_item_id text)` con `pg_advisory_xact_lock` para impedir saldos negativos o compras duplicadas.

4. **Ajuste en `public.subscriptions`, `lib/payments/references.ts` y `purchases.ts`**
   - Agregar el prefijo `monedas:` (`COIN_PACK_PREFIX`) en `lib/payments/references.ts` para compras únicas de packs de monedas con `rowPurchase` en `lib/payments/purchases.ts`.
   - Hacer `shipping_address` opcional para planes digitales (`provider_plan_id` del Club).
   - En `record_subscription_payment` y `record_paypal_subscription_payment`, insertar en `public.shipments` solo si el plan requiere envío físico, acreditar las monedas de regalo mensuales del socio y activar `club_galleries` cuando el pago se acredita.

---

## Costos y punto de equilibrio

Con unos USD 45 fijos por mes, **dos socios ya cubren los planes pagos y las comisiones**, y la venta de packs de monedas tiene **margen casi 100% limpio** (solo descuenta la comisión de Mercado Pago / PayPal, sin costo de envío ni de servidor).

| Concepto | Cuándo empieza | Costo por mes |
| --- | --- | --- |
| **Vercel Pro** | Antes de cobrar la primera cuota | USD 20 por integrante del equipo (aprox.) |
| **Supabase Pro** | Cuando la base, archivos o Realtime pasen el plan gratis | USD 25 (aprox.) |
| **Cloudflare R2** | Ya en uso | USD 0 hasta 10 GB y 10 millones de lecturas; salida gratis |
| **Mercado Pago y PayPal** | En cada cobro de membresía o pack de monedas | Comisión porcentual de cada pasarela |

Fuentes: [precios de R2](https://developers.cloudflare.com/r2/pricing), [límites de Vercel Hobby y Pro](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing).

---

## Reglas técnicas que no se pueden romper (`CLAUDE.md` / `AGENTS.md`)

- **Cero llamadas a Functions por visita común:** `/club/[slug]` no exige login para entrar, por lo que puede listarse con su copia estática o servirse con `revalidate` / `s-maxage` desde el CDN, a diferencia de `/galeria-3d` que hoy tiene `force-dynamic` por el gate de sesión.
- **Nunca dibujar imágenes por pedido** (satori `ImageResponse`, `sharp`): cachear lo dibujado (`lib/share-image-cache.ts`, R2 o ISR). `lib/cost-guards.test.ts` lista los permitidos.
- **Archivos 3D, pistas de audio y fotos de obras** van siempre al bucket público de R2 (`NEXT_PUBLIC_GALLERY_ASSETS_URL`), nunca por Vercel.
- **Rutas nuevas que no leen la sesión** quedan fuera del matcher de `proxy.ts` (`proxy.test.ts`).
- **Textos en los 9 idiomas** (`lib/i18n/messages/*.ts`), verificados por `messages.test.ts`.
- **Migraciones SQL probadas en PGlite** antes de aplicarlas en producción; correr `npm test`, `npx tsc --noEmit` y `npx eslint` antes de cada commit; un commit por tema y push a `main` en tandas revisando antes `git log origin/main..HEAD`.

---

## Decisiones recomendadas (listas para validar)

1. **¿Visitar exige iniciar sesión?** → **No para entrar y caminar**, sí (modal suave con regreso a la misma obra vía `galleryReturnPath`) cuando el visitante toca «Guardar estampilla», «Me gusta», «Comentar» o «Pegar en el muro».
2. **¿Cómo arrancan las monedas en la Etapa 1?** → Se compran con plata en packs únicos (Mercado Pago / PayPal) + cada cuota mensual del Club trae un pack de monedas de regalo incluido. Desde el día 1 ya sirven para comprar **nuevos temas de sala** (como *Museo Nocturno*, *Taller Kraft*, *Hormigón*), **marcos especiales**, **música ambiental** y **ampliación de sala**.
3. **¿Cuántas obras y salas entran en una galería?** → Tres plantillas en Etapa 1: *Gabinete* (8 obras), *Sala Clásica* (14 obras, incluida de base) y *Galería Doble* (22 obras, desbloqueable con monedas).
4. **¿Qué pasa con la galería principal del Mundial?** → Sigue siendo el **Museo Central** con la rotación diaria de 37 obras de todos los participantes, y suma una **Puerta al Club** que deriva tráfico diario hacia las salas de los socios.
5. **¿Qué pasa si un socio se da de baja o falla el pago?** → Su galería pasa a `status = 'paused'`, pero **conserva intactos su saldo de monedas, todos los temas/objetos que compró (`user_gallery_inventory`), sus obras y sus estadísticas** para cuando vuelva a activarla.
