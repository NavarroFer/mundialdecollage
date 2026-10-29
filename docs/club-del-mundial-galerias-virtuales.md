# Club del Mundial de Collage: galerías virtuales

16 de octubre de 2026 · Fer

## Resumen

El Club del Mundial de Collage es una membresía mensual que le da a cada artista su propia galería 3D, configurable y conectada con las de los demás en un mapa, junto con una economía de monedas para destrabar salas más grandes, temas con clima de taller o museo, marcos y ropa para su avatar. Cuesta $29.000 por Mercado Pago o USD 29 por PayPal, por mes.

- **Por qué un artista entra al Club:** en la galería general del Mundial hay más de 300 obras rotando en 37 lugares por día (`ensure_exhibition_today()`), así que cada obra aparece solo cuando le toca su turno en la fila diaria. En el Club, el artista tiene **su propia muestra permanente abierta las 24 horas**, con toda su serie de obras, su texto de sala y su enlace propio.
- **Se paga por tener galería y personalizarla, no por visitar:** el artista paga para que lo vean. Cada visitante que entra suma valor a su membresía, así que las visitas quedan abiertas sin exigir inicio de sesión (solo se pide cuenta de Google cuando alguien quiere dar me gusta, guardar una estampilla en su álbum, comentar o pegar en el muro). Además, no pedir sesión al entrar permite servir la galería desde el CDN de Vercel sin gastar CPU.
- **La membresía incluye monedas todos los meses:** para que el socio no sienta que le cobramos dos veces, su cuota mensual le deposita monedas cada mes en su billetera. Con esas monedas puede ir destrabando mejoras a su ritmo, o comprar packs de monedas aparte con plata si quiere todo desde el primer día.
- **Para quién:** artistas del Mundial, un público adulto de más de 30 años, en Argentina y en el exterior.

## Qué recibe un socio

Un socio recibe su galería, monedas mensuales para mejorarla, un lugar en el mapa y los datos de quién la visita.

- **Su galería 3D:** arranca con una sala inicial de **6 a 8 obras** y los 3 temas base (*Collage*, *Jardín*, *Windows 98*), cuelga sus obras en el orden que quiera, elige cómo se ven los cuadros (marcos o clavados en la pared) y escribe los textos de sala.
- **Monedas todos los meses:** cada cuota acreditada suma monedas a su billetera para destrabar salas más grandes (14 o 22 obras), temas nuevos, marcos, música y ropa para su avatar.
- **Su avatar anfitrión y su ropa:** elige entre los avatares realistas, configura su ropa y accesorios (y puede comprar prendas, telas o accesorios nuevos con monedas). Cuando el artista no está conectado, su avatar recibe a las visitas en la entrada con una placa con su nombre; al acercarse y tocarlo (o apretar `E`) se abre su carta de bienvenida con la bio, el texto de sala y sus redes. Cuando entra con su cuenta, el anfitrión desaparece y pasa a manejar su avatar en vivo, con un distintivo «Artista en sala».
- **Un lugar en el mapa** de galerías, que el socio elige haciendo clic en el mapa, sin dar su dirección (ver «Etapas»), una puerta de paso entre galerías del Club y un enlace propio para compartir.
- **Integración con el Álbum de estampillas:** sus obras pasan a ser coleccionables en el Álbum de los visitantes.
- **Estadísticas de visitas:** cuántas personas entraron, cuánto miraron cada obra («Atención por obra»), cuántas guardaron sus obras como estampillas y cuántas fotos de recuerdo sacaron. Además, un resumen semanal en sus notificaciones (`user_notifications`): «Esta semana 42 personas recorrieron tu galería y guardaron 19 estampillas de tus obras».
- **Presencia en vivo:** ve quién está recorriendo su galería en este momento.
- **Más adelante:** decoración libre de la sala con muebles y objetos, tipo Sims.

## Economía de monedas y mejoras

Las monedas convierten la evolución de cada galería en un juego de colección continua y suman una vía de ingresos por compras únicas sin esperar a la etapa 3.

### Cómo se consiguen las monedas

1. **Incluidas en la cuota mensual del Club (Camino A):** cada mes que el socio paga su membresía se le acreditan **600 monedas**. Con eso destraba un marco cada mes, un tema en 2 meses o junta la Sala Clásica en unos 4, así que mantener la suscripción activa conviene y comprar un pack acelera.
2. **Compra directa con plata (desde el día 1):** packs de monedas de pago único por Mercado Pago o PayPal, tanto para socios que quieren destrabar todo rápido como para usuarios que quieren vestir su avatar. Una moneda equivale a unos $10 o USD 0,01:

   | Pack | Monedas | Pesos | Dólares |
   | --- | ---: | ---: | ---: |
   | *Pack Chico* | 500 | $5.000 | USD 5 |
   | *Pack Mediano* | 1.725 (1.500 + 15 %) | $13.000 | USD 13 |
   | *Pack Mecenas* | 4.550 (3.500 + 30 %) | $30.000 | USD 30 |

3. **Jugando en el sitio («efecto alcancía»):** dar *Me gusta* a una obra da **1 moneda** y guardar una estampilla en el Álbum da **3**, con un tope de **20 monedas por día** por cuenta. Así todos ven su contador con saldo real desde el primer día y es más fácil que compren un pack para llegar a la mejora que quieren.
4. **Logros del socio:** cada logro de su sala da **200 monedas**, una sola vez por logro: las primeras 50 visitas, 10 obras suyas guardadas en álbumes de visitantes y su primera inauguración en vivo con visitantes en la sala.

### Precios del catálogo

Valores de referencia para `lib/gallery-catalog.ts`; se ajustan con el uso real.

| Ítem | Monedas |
| --- | ---: |
| Marco o montaje (madera, dorado, passepartout, alfileres) | 300 |
| Tema (*Taller*, *Galpón Industrial*, *Museo Clásico*, *Callejón*) | 1.200 |
| Sala Clásica (14 obras) | 2.500 |
| Galería Doble (22 obras) | 5.000 |

### Qué se configura y qué se compra con monedas

| Mejora | Cómo arranca de base | Qué se destraba con monedas | Etapa |
| --- | --- | --- | --- |
| **Tamaño de sala (capacidad)** | **Sala Gabinete (6 a 8 obras)** incluida con el alta del Club | **Sala Clásica (14 obras)** y **Galería Doble (22 obras)** | Etapa 1 |
| **Temas con clima de taller o museo real** | *Collage*, *Jardín* y *Windows 98* | *Taller de Artista* (piso de madera manchado, mesas con recortes), *Galpón Industrial* (ladrillo y hierro), *Salón de Museo Clásico* (parquet espina de pescado, paredes bordó o verde inglés), *Callejón de Afiches* | Etapa 1 |
| **Cómo se ven los cuadros colgados** | Marco estándar del tema | Configurable por el artista (para toda la sala o por obra): marco de madera natural, marco dorado clásico, passepartout negro, o *collage suelto pegado con cinta de papel / alfileres* sin marco | Etapa 1 |
| **Ropa y accesorios del avatar** | Ropa por defecto del personaje elegido | Cambio de telas y colores de las prendas (`fabrics.ts`), accesorios sobre el esqueleto (`Bip01`: delantal de taller, boina, anteojos, *tote bag* del Mundial, café o tijeras en mano) y personajes exclusivos | Etapa 1 / 2 |
| **Música y clima sonoro** | La consola de vinilos con la lista de dominio público (`components/gallery/vinyl/tracks.json`) | Discos nuevos para la consola: *Jazz de Vernissage*, *Lluvia en el Taller*, *Ambient de Museo*, de dominio público o con licencia y anotados en `public/music/CREDITS.md` | Etapa 1 / 2 |
| **Objetos y muebles de sala** | Sala despejada | Etapa 2: objetos en lugares fijos (bancos de museo, plantas, alfombras, mesa de brindis). Etapa 3: decoración libre tipo Sims | Etapa 2 / 3 |

Todo lo que un artista destraba con monedas queda guardado para siempre en su inventario (`user_gallery_inventory`), incluso si algún mes pausa su suscripción.

## Gamificación y tráfico entre galerías

Para que ninguna galería quede vacía después del primer día, el Club se engancha con el Álbum de estampillas, el Pasaporte y el muro colectivo que ya funcionan en el sitio:

- **Cupo bonus de estampillas en el Álbum:** hoy `collect_gallery_artwork_stamp` permite guardar solo **3 obras cada 12 horas** en el museo principal. Recorrer la galería de un socio del Club habilita **1 estampilla extra gratuita de esa sala** fuera del límite de las 3 generales, además de un **Sello Postal del Artista** (con su nombre, su país y la fecha) en el `Passport.tsx` al descubrir todas sus obras. Cada socio tiene su propia plancha en el Álbum con las obras de su galería.
- **Avatar anfitrión y sello «Estuve en el Vernissage»:** si un visitante entra a la galería en el mismo momento en que el artista dueño está conectado en vivo (`GalleryPresence.tsx`), ambos desbloquean el sello *«Conocí a {Artista} en vivo en su galería»*. Esto le sirve al artista para convocar inauguraciones con día y hora desde su Instagram.
- **Tablero Kraft de visitas por galería:** cada sala puede tener su propio cuadro de papel Kraft (`CollageWall.tsx`) donde los visitantes pegan un recorte o su foto polaroid (`Souvenir.tsx`) dedicada al artista, moderado por el propio dueño de la sala.
- **Puerta al Club (paso continuo entre salas):** en cada galería hay una puerta con una placa que anuncia la siguiente sala («Siguiente sala: {Artista} · {País}») y lleva a otra galería activa del Club, con prioridad para las que tienen gente en vivo o que el visitante todavía no selló en su pasaporte. En la Galería 3D principal del Mundial se suma un acceso destacado hacia las salas de los socios.
- **Botón de consulta directa:** en la ficha de cada cuadro, el socio puede activar un botón *«Consultar al artista por esta obra»* (WhatsApp o mail) para vender sin comisiones.

## Etapas

El Club arranca por la galería de cada socio y la economía de monedas; el mapa y la decoración libre llegan después, cuando la etapa anterior cumple su puerta.

1. **Mi galería + Monedas y Mejoras + Álbum:** sala inicial de 6–8 obras y salas destrabables con monedas (14 y 22 obras), temas de taller y museo, configuración de marcos, ropa de avatar, textos de sala, enlace propio y estadísticas de visitas.
   - Puerta 1: los primeros socios usan, personalizan y comparten su galería.
2. **Mapa de galerías y objetos de sala:** cada galería es un punto del mapa, se pasa de una a otra, visitantes en vivo, un lugar destacado y primeros objetos decorativos en sala.
   - **Dónde queda la «casa» de cada socio:** lo elige el propio socio haciendo clic en el mapa, sin escribir ninguna dirección. Se guarda solo una posición aproximada, redondeada a unos 10 km, nunca una dirección ni el punto exacto, y en el mapa público se dibuja con una pequeña variación fija para que dos vecinos no queden uno encima del otro. Al ser un dato de la galería, la tabla `club_galleries` suma dos columnas (latitud y longitud ya redondeadas) y los puntos salen de un listado cacheado en el CDN, no del render de la página. El selector va en el editor.
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
| Acceso y CDN | `/galeria-3d` con `force-dynamic`, porque pide sesión para entrar; `/artistas/[slug]` con copia `anon/` | `/club/[slug]` sin login para entrar, con copia `anon/` como `/artistas/[slug]`, y Google solo al interactuar |
| Mapa | Mapa mundial del sitio (`world-map`) | Las galerías como puntos y el paso de una a otra (Etapa 2) |
| Cobro mensual y packs | Suscripciones con Mercado Pago y planes/órdenes de PayPal (`lib/payments/`) | El plan mensual del Club (que acredita monedas y activa la galería) y los packs de monedas de compra única (`monedas:`) |
| Estadísticas | «Atención por obra» en el panel de admin (`AttentionRecorder.tsx`) y notificaciones (`user_notifications`) | Una vista por socio, solo de las obras de su galería, y su resumen semanal |

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

- **Pesos (suscripción Club):** $29.000 por mes con Mercado Pago. El precio se ajusta **cada 3 meses**, con aviso al socio **30 días antes**.
- **Dólares (suscripción Club):** USD 29 por mes con un plan de PayPal, para socios del exterior.
- **Packs de monedas (compra única):** disponibles en pesos (Mercado Pago Checkout Pro) y en dólares (PayPal Orders), con los precios de la tabla de packs.
- **Plan anual:** se paga **10 meses y se usan 12**: $290.000 o USD 290 por año, con el precio en pesos fijo durante ese año. Las 600 monedas se acreditan igual mes a mes, no las 7.200 juntas, para que una devolución dentro de los 10 días de arrepentimiento no deje monedas ya gastadas.
- **Alta:** al confirmarse el primer pago se crea la galería con la sala inicial (6–8 obras), se acreditan las monedas de bienvenida del mes y se abre el editor.
- **Baja o pago rechazado:** la galería sale del mapa y queda en pausa (`status = 'paused'`), sin borrarse ni perder las salas, temas, ropa ni monedas compradas, para que vuelva intacta si el socio paga de nuevo.

## Decisiones cerradas y puntos abiertos

Decisiones ya definidas:

- [x] **Modelo de membresía y monedas (Camino A):** la cuota mensual de $29.000 / USD 29 mantiene activa la galería e incluye un depósito mensual de monedas; además se venden packs de monedas con plata.
- [x] **Ganar monedas por actividad:** dar *Me gusta* y coleccionar estampillas en el Álbum otorga pequeñas cantidades de monedas para activar el «efecto alcancía».
- [x] **Capacidad de salas:** la galería arranca con una sala para **6 u 8 obras**, y con monedas se destraban salas más grandes (14 y 22 obras).
- [x] **Temas desbloqueables:** sumar temas con climas de *Taller de Artista* y *Museo Real* comprables con monedas.
- [x] **Montaje de cuadros configurable:** el artista elige cómo se ven colgados sus cuadros (distintos marcos o pegados/clavados sin marco).
- [x] **Ropa de avatar elegible y comprable con monedas:** personalización de prendas, telas y accesorios para el avatar.
- [x] **Monedas de la cuota:** 600 por mes, también en el plan anual. Son un 21 % del valor de la cuota al precio de los packs.
- [x] **Precio de la cuota:** $29.000 / USD 29 (antes $47.000 / USD 47). Queda por debajo del plan Miembro de la tienda ($36.000), que incluye envío físico, porque el Club es digital y sin envío. Con una comisión del 10 % (a confirmar con la cuenta real) cada socio deja unos $26.100, así que dos socios cubren los USD 45 fijos al cambio de $1.000 por dólar que usa el sitio.
- [x] **Packs:** Chico, Mediano y Mecenas a $5.000 / $13.000 / $30.000 o USD 5 / 13 / 30.
- [x] **Monedas por actividad y logros:** 1 por like y 3 por estampilla, con tope de 20 por día; 200 por cada logro del socio.
- [x] **Precio en pesos y plan anual:** ajuste cada 3 meses con 30 días de aviso; plan anual de 10 meses por 12, en pesos y en dólares.

Ya no quedan decisiones de producto abiertas para la etapa 1. Antes de cobrar falta lo operativo de «Próximos pasos» y los términos del Club (ver «Lanzamiento»).

Riesgos a cuidar:

- **Mapa vacío:** con pocas galerías, recorrer el mapa decepciona. Por eso el mapa abre en la etapa 2, cuando ya hay galerías, y en la etapa 1 se conecta una galería con otra mediante la «Puerta al Club».
- **Equilibrio de monedas:** las monedas ganadas gratis dando like o juntando estampillas tienen que alcanzar para tentar (y tal vez comprar un accesorio chico o un marco), pero los temas de museo y las ampliaciones de sala deben requerir las monedas de la membresía o comprar un pack. Con el tope de 20 por día, alguien muy activo junta hasta 600 por mes: un marco en 15 días, un tema en 2 meses. Si eso le quita ventas a los packs, se baja el tope antes que el precio de los ítems.
- **Visitantes en vivo:** cada galería con gente usa conexiones de Realtime. El tope de 8 avatares por galería acota los mensajes, no las conexiones.
- **Alcance del editor:** la decoración libre tipo Sims es un proyecto en sí mismo; va en la etapa 3.

## Estado y pendientes

Al 29 de octubre de 2026 (actualizado el 30, con el mapa, las muestras, el resumen semanal y el 3D). Todo lo hecho está en commits locales, todavía sin subir a `main`.

**Hecho**

- [x] **Base de datos del Club** (galerías, obras colgadas, billetera, monedas, inventario, estadísticas del socio y estampilla extra), probada en PGlite como cada rol.
- [x] **Cobro:** cuota mensual de $29.000 / USD 29 por Mercado Pago y PayPal (PayPal en cuanto se cargue su plan) y packs de monedas. Con 600 monedas por mes.
- [x] **Galería:** 3 salas, 4 temas nuevos, 4 marcos, ropa del avatar (lógica) y catálogo de precios.
- [x] **Pantallas:** `/club` y su franja en la home, `/club/[slug]` (en el CDN), `/mi-galeria` y el editor (datos, obras colgadas, tienda de monedas y estadísticas de los últimos 30 días).
- [x] **Interruptor `CLUB_OPEN`:** el Club arranca cerrado y los admins lo prueban en producción.
- [x] **Términos del Club** y aviso de aceptación junto a los botones de pago.
- [x] **Campaña:** público «Artistas sin galería del Club», plantilla `club_lanzamiento`, enlaces marcados con `?desde=mail`, freno mientras el Club está cerrado e invitación en el aviso diario «Así le fue a tu obra».
- [x] **Gamificación ya hecha:** primera estampilla de cada galería fuera del límite de 3 cada 12 horas, y botón «Consultar al artista por esta obra» (WhatsApp o web; el enlace solo puede ser `http(s)`, también en la base de datos).
- [x] **Mercado Pago y PayPal configurados** (plan de PayPal y variables cargadas en Vercel el 29/10). Toman efecto con el próximo deploy.
- [x] **Galería de cortesía** (`/admin/club`, en «Galería 3D»): con el email de la cuenta, la galería queda activa sin suscripción y con monedas de regalo (`courtesy_granted_at`, monedas de tipo `gift`). Con el mismo formulario se suman más monedas; «Terminar cortesía» la pausa sin borrar nada. Un cambio de cobro de una suscripción vieja nunca pausa una cortesía. La persona tiene que haber entrado al sitio una vez con Google.
- [x] **Acceso con el Club cerrado:** quien ya tiene una galería activa (los fundadores) entra a `/mi-galeria`, al editor y a los packs aunque falte `CLUB_OPEN`; suscribirse sigue esperando la apertura.
- [x] **Casa en el mapa y mapa del Club:** el socio toca el mapa del editor (se guarda redondeado a ~11 km) y `/club` muestra todas las casas con zoom (rueda, dos dedos, botones); cada casa abre artista, obras y «Entrar a su galería». Los datos salen de `/api/club/casas` (CDN), que también usa la Puerta al Club.
- [x] **Galerías de muestra en `/club`:** se marcan desde `/admin/club` («Mostrar en /club»).
- [x] **Resumen semanal** en la campanita de cada socio, los lunes (cron diario `exhibition`).
- [x] **PDF de bases** regenerado con la sección del Club.
- [x] **3D:** Puerta al Club con placa «Siguiente sala», anfitrión con carta de bienvenida, sello postal del artista (la base lo verifica con la atención registrada), sello «Estuve en el Vernissage» (depende de la presencia en vivo, se puede falsear) y tablero Kraft por galería, moderado por el socio desde el editor. Verificado a la vista solo en la sala Gabinete, con un build de producción local.
- [x] **Subir obras al Club** desde el editor (hasta 30, `is_club_only`): la base las rechaza como obra postulada o principal, y quedan fuera del selector de la convocatoria, del tope de obras guardadas, de `/admin/obras`, del emparejamiento con Registro y del público «Varias obras». A quien no tiene nombre o país en su perfil se los pide antes de la primera. La galería firma las obras aunque el perfil esté oculto.

**Verificado antes de subir (29/10/2026)**

- Lint del proyecto completo, `tsc`, las 168 pruebas (1024 casos) y `next build` en un checkout limpio sin variables de entorno, como lo corre el CI de GitHub.
- Las 6 migraciones nuevas (`20261029120000` a `20261029170000`; después se sumaron `20261029180000` y `20261029190000`, probadas igual con `club-courtesy.mjs` y `club-artworks.mjs`) aplicadas en PGlite sobre todas las anteriores, con escenarios por rol. Están en `scripts/pglite/` (`npm install --no-save @electric-sql/pglite` y `node scripts/pglite/<script>.mjs`).
- `scripts/pglite/store-regression.mjs` corre el mismo escenario de la tienda antes y después de las migraciones del Club: pagos de suscripción de Mercado Pago y PayPal, envíos, «Me gusta» y estampillas dan idéntico.
- Errores que encontraron estas pruebas y ya están corregidos: las reglas de acceso de las obras colgadas se llamaban entre sí («infinite recursion») y ningún socio podía colgar obras, y el enlace de contacto aceptaba `javascript:`.

**Para abrir el Club (tuyo)**

- [x] Pasar el proyecto a Vercel Pro.
- [x] Configurar Mercado Pago y PayPal (plan del Club y `PAYPAL_PLAN_ID_CLUB_MONTHLY`).
- [ ] Subir los commits a `main` en una sola tanda. Ojo: `.github/workflows/supabase-migrations.yml` aplica las migraciones en paralelo al CI, sin esperarlo; por eso todo se verifica antes (ver arriba). El deploy deja el Club cerrado.
- [ ] Probar un cobro real con una cuenta admin (`lib/admin.ts`). No hay entorno de Preview, así que la prueba es en producción con plata real y el Club cerrado. Orden sugerido: primero un Pack Chico ($5.000) y ver que lleguen las 500 monedas; después la cuota ($29.000) y ver que la galería pase a `active` con 600 monedas; cancelar y ver que quede en `paused`.
- [ ] Revisar con alguien de lo legal la sección del Club, sobre todo el arrepentimiento, y si hace falta un botón de baja visible.
- [ ] Armar 2 o 3 galerías de muestra con socios fundadores (pedirles permiso), con la cortesía de `/admin/club`. Si no hay fundadores, Fer arma la suya y la de un amigo con sus obras.
- [ ] Abrir con `CLUB_OPEN=on` y un deploy; recién ahí mandar la campaña.

**Cómo retomar**

- `main` local va adelante de `origin/main` con todo esto, y no hay nada nuevo del otro lado. Antes de subir, `git log origin/main..HEAD` por si otra sesión commiteó.
- Lo siguiente es el push cuando Fer lo diga, después la prueba de cobro real y las galerías de muestra con la cortesía, y después lo de «Falta construir», empezando por elegir la casa en el mapa.
- Las partes 3D (avatar anfitrión, vernissage, Puerta al Club, tablero Kraft) conviene hacerlas con Fer mirando la pantalla: las pruebas automáticas no detectan un error visual.

**Falta construir**

- [ ] **Captura de una galería de muestra para la home**, cuando haya una armada (imagen fija en R2).
- [ ] **Contar las visitas sin cuenta.** Hoy el panel mide solo a quienes tienen cuenta, porque la atención exige una; contar las otras necesita un contador agregado y cacheado.
- [ ] **Plan anual** y el proceso mensual que acredita las 600 monedas.
- [ ] **Ajuste trimestral del precio en pesos:** hay que actualizar cada suscripción de Mercado Pago y avisar 30 días antes.
- [ ] **Devolución por arrepentimiento:** hoy sería manual (devolver el pago y retirar las monedas); falta una herramienta de admin.
- [ ] **Música del Club:** discos nuevos para la consola, de dominio público o con licencia, y mover las pistas a R2.
- [ ] **PDF de bases y términos:** volver a generarlo con la sección del Club (`scripts/build-bases-pdf.mts`).
- [ ] **Etapa 2** (mapa de galerías, objetos de sala) y **etapa 3** (decoración libre).

## Lanzamiento: landing y campaña de mail

Cuando los fundadores ya tienen sus galerías armadas y compartidas (Puerta 1), el Club se abre al resto con una página propia, una sección en la landing y una campaña de mail, en ese orden: así el enlace del mail lleva a algo que ya se puede recorrer.

0. **Interruptor de lanzamiento (`CLUB_OPEN`, ya hecho):** el Club arranca cerrado. Mientras `CLUB_OPEN` no valga `on`, `/club` solo se abre con el link (fuera de Google), la franja de la home y la entrada del mapa del sitio no existen, y nadie puede suscribirse, comprar monedas ni editar, salvo las cuentas de `lib/admin.ts`, que pueden probar todo el recorrido en producción con cuentas reales. Abrirlo es poner `CLUB_OPEN=on` en Vercel y hacer un deploy: va después de la prueba de cobro real, de crear el plan de PayPal y de las galerías de muestra. Las galerías ya activas siguen visibles aunque el interruptor esté apagado.
1. **Galerías de muestra:** 2 o 3 galerías de fundadores, completas y con permiso de sus dueños, sirven de ejemplo. Como entrar no pide sesión, el enlace abre la sala directamente.
2. **Página del Club (`/[locale]/(site)/club`, ya hecha):** qué recibe un socio, el precio en pesos y en dólares y el botón para suscribirse. Es igual para todos, así que está en `lib/static-pages.ts` con su copia `anon/`; el botón lleva a `/mi-galeria`, que sí lee la sesión. Falta sumarle las galerías de muestra cuando existan.
3. **Sección en la landing (`app/[locale]/(site)/page.tsx`, ya hecha):** el bloque `ClubSection` va después de `HomeStoreSection`, con una frase y el enlace a la página del Club. Falta sumarle una captura de una galería de muestra.
   - Textos en los 9 idiomas, leídos con `getI18n()`.
   - La captura es una imagen fija en R2; nunca se dibuja por pedido.
   - Si se muestra cuántos socios hay, el número sale de la base por un endpoint cacheado en el CDN, nunca escrito a mano.
   - Después de `next build`, la ruta `anon` de la home sigue en ●.
4. **Campaña desde `/admin/campanas`:** la herramienta ya traduce cada mail al idioma del contacto (`lib/email-translation.ts`), agrega el pie para darse de baja, respeta bajas, rebotes y quejas (`lib/campaign-audience.ts`), cuenta aperturas con el webhook de Resend y programa envíos que manda el cron diario (`app/api/cron/campanas`). Ya está hecho para el Club:
   - **Público nuevo** «Artistas sin galería del Club» (`club_prospects`): suscriptos que participaron y no tienen galería, activa o no, sin admins. Lo arma `club_member_emails()` junto con `participant_emails()`.
   - **Plantilla de lanzamiento** `club_lanzamiento`, que aparece sola en `/admin/plantillas`: abre con «¿Querés que tus obras tengan su casa?», explica la sala, los temas y las monedas, muestra el precio y manda a `/club`. Si el precio cambia, se edita ahí.
   - **Enlaces marcados solos:** todo enlace al sitio en un mail masivo lleva `?desde=mail` (`lib/mail-links.ts`), así `/admin/estadisticas` cuenta cuántas altas vinieron del mail.
   - **Freno:** mientras el Club esté cerrado, Campañas no manda a ese público, ni de forma manual ni programada.
   - **Invitación en el aviso diario** «Así le fue a tu obra» (`novedades_obra`): la pregunta gancho más un botón «Crear mi galería», que se suma sola cuando se abre el Club.
5. **Cupo de envíos:** las campañas salen como envío masivo (`lib/mail/index.ts`): primero por Brevo, después por Resend dejando 20 de reserva para los recibos. Lo que no entra en ningún cupo igual se manda por Brevo, que puede rechazarlo. Con una lista más grande que el cupo del día (`/admin/envios`), conviene programar la campaña en tandas.
6. **Términos antes de cobrar:** sumar a `lib/terms.ts` una sección del Club con qué incluye la cuota, cómo se da de baja, el arrepentimiento de 10 días que ya figura para las compras (art. 34 de la Ley 24.240) y que las monedas no tienen valor en dinero, no se transfieren y no se reembolsan una vez gastadas. Confirmar con quien lleve lo legal si el sitio necesita un botón de baja o de arrepentimiento visible.
7. **Medir:** visitas a la página del Club y a las galerías de muestra, aperturas de la campaña y altas por origen.

## Anexo técnico: reglas que no se pueden romper

El sitio corre en Next.js 16 sobre Vercel, con 4 horas de CPU activa cada 30 días para todo el equipo en el plan Hobby; si se acaban, el proyecto se pausa. Cada cambio tiene que mantener bajo el costo por visita, también después de pasar a Pro.

- **Leer primero** `AGENTS.md` y `CLAUDE.md` en la raíz. Esta versión de Next.js cambia APIs: la guía vigente está en `node_modules/next/dist/docs/`.
- **Nunca dibujar imágenes por pedido** (satori `ImageResponse`, sharp): cachear lo dibujado (`lib/share-image-cache.ts`, R2 o ISR). `lib/cost-guards.test.ts` lista los permitidos.
- **Lo que es igual para todos** sale con `Cache-Control` y `s-maxage`, para que responda el CDN y no una Function. Se verifica con `curl -D -` dos veces: `x-vercel-cache: HIT`.
- **Nada de `force-dynamic`, `cookies()`, `headers()` ni sesión** donde no hace falta; preferir `revalidate`.
- **Rutas nuevas que no leen la sesión** quedan fuera del matcher de `proxy.ts`; lo controla `proxy.test.ts`.
- **Páginas públicas** viven en `app/[locale]/(site)/`. Las listadas en `lib/static-pages.ts` (como `/galeria-3d`) tienen una copia `anon/` construida de antemano: ahí la sesión se lee solo con `getCurrentUser()` o `createClient()` (`lib/supabase/server.ts`) y el idioma con `getI18n()`. Después de `next build`, las rutas `anon` muestran ●, nunca ƒ.
- **`/club/[slug]` no copia a `/galeria-3d`:** la galería general usa `force-dynamic` porque pide sesión para entrar. La del Club se suma a `lib/static-pages.ts` con su copia `anon/`, como `/artistas/[slug]`, y cuando pide Google para interactuar vuelve a la misma obra con `galleryReturnPath`, como ya hacen `ArtworkStamp`, `ArtworkLike` y `ArtworkComments`.
- **Archivos 3D y pesados** van al bucket público de R2 (`NEXT_PUBLIC_GALLERY_ASSETS_URL`), nunca por Vercel ni por `next/image`. Esto incluye los discos nuevos de la consola: hoy las 4 pistas de `public/music/` (unos 18 MB) salen por Vercel.
- **Calidad gráfica adaptable:** los temas, marcos y objetos nuevos respetan los 4 niveles de `docs/gallery-graphics.md` (de Bajo a Ultra): mapas procedurales de 128², texturas que se liberan al cambiar de tema y nada de postprocesado sobre las obras.
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
| Música | `gallery/ui/BackgroundMusic.tsx`, `gallery/vinyl/` (`VinylConsole.tsx`, `tracks.json`), `public/music/CREDITS.md` | La consola de vinilos elige el disco; cada pista lleva su fuente y licencia |
| Calidad gráfica | `docs/gallery-graphics.md`, `Scene.tsx`, `world/Lighting.tsx` | 4 niveles (Bajo, Medio, Alto, Ultra) con regulador por tiempos de cuadro |
| Notificaciones | `supabase/migrations/20261005120000_notifications.sql`, `app/[locale]/(site)/notificaciones` | Base del resumen semanal al socio |
| Mapa | `components/world-map.tsx`, `map-explorer.tsx` | |
| Estadísticas y atención | `gallery/attention/AttentionRecorder.tsx`, `components/admin/stats/`, `supabase/migrations/20261011180000_gallery_attention.sql` | «Atención por obra» mide mirada directa (> 2s a < 5m) y apertura de ficha |
| Landing | `app/[locale]/(site)/page.tsx`, `anon/page.tsx`, `lib/static-pages.ts` | La copia `anon/` reutiliza la misma página y se sirve desde el CDN |
| Campañas de mail | `app/[locale]/(site)/admin/campanas`, `lib/campaign-audience.ts`, `lib/campaign-delivery.ts`, `lib/mail/index.ts`, `lib/visit-source.ts` | Audiencias, traducción, bajas, cupo entre Brevo y Resend, y origen de cada alta |
| Textos | `lib/i18n/messages/*.ts` | 9 idiomas; `messages.test.ts` controla los marcadores como `{name}`; las claves las exige TypeScript, con `es.ts` como modelo |

## Propuesta técnica detallada para la etapa 1 y forma de trabajo

Guía lista para implementar paso a paso:

### 1. Modelo de datos en Supabase

- **Reutilizar `public.artworks` para las obras colgadas:** en lugar de crear una tabla paralela de obras que obligue a duplicar likes, comentarios, estampillas y medición de atención, permitir que los socios del Club suban más obras en `public.artworks` (marcadas con `is_club_only = true` cuando no son la obra que concursa en el Mundial) y referenciarlas desde `public.club_gallery_hangings (gallery_id, slot, artwork_id, frame_style, for_sale, price_label)`, con `primary key (gallery_id, slot)`, `unique (gallery_id, artwork_id)` y borrado en cascada desde la galería y desde la obra. Así `ArtworkLike`, `ArtworkComments`, `ArtworkStamp`, `Souvenir` y `AttentionRecorder` funcionan sin cambios.
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
  - `coin_transactions (id uuid primary key, user_id uuid, delta integer not null, kind text, reference_id text, created_at timestamptz, unique (kind, reference_id))`: un libro de movimientos que solo crece, con `kind` en `'subscription_bonus'`, `'purchase'`, `'activity'`, `'achievement'`, `'spend'` o `'refund'`. El `unique` garantiza idempotencia ante reintentos de webhooks o acciones repetidas.
  - `user_gallery_inventory (user_id uuid, item_id text, unlocked_at timestamptz, primary key (user_id, item_id))`.
  - Función RPC `spend_coins_on_item(p_item_id text)` con `pg_advisory_xact_lock` que verifica el precio en el catálogo, descuenta de `club_wallets` e inserta en `user_gallery_inventory`.
  - El cliente solo tiene `select` sobre su billetera, sus movimientos y su inventario. Las monedas las acredita el servidor (`service_role`) al confirmarse un pago, o las funciones de like y estampilla; se gastan únicamente con `spend_coins_on_item`.
  - En `like_gallery_artwork` y `collect_gallery_artwork_stamp`, acreditar las monedas de recompensa con tope diario por cuenta para evitar abuso.
- **Ajuste importante en `record_subscription_payment` (`20261001150000_mercadopago_subscriptions.sql`) y `record_paypal_subscription_payment` (`20260930020000_paypal_store.sql`):**
  - Hoy las dos insertan siempre una fila en `public.shipments` porque asumen envío postal físico. Para el plan `'club'`, hacer `shipping_address` opcional, no insertar en `shipments`, acreditar las monedas mensuales del socio en `club_wallets` y poner `club_galleries.status = 'active'`.
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
