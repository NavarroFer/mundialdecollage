# Roadmap

Notas de producto para las próximas etapas del sitio (post feedback de Fer,
2026-09-16). No son features urgentes — son la dirección para cuando haya
obras y participantes reales.

## Principio: no promocionar el taller antes de tiempo

No poner el taller/curso arriba de todo en la home. Primero hay que construir
prestigio alrededor del Mundial en sí mismo — el taller es secundario hasta
que el evento tenga tracción propia. Mantener `WorkshopSection` donde está
(después de `AboutSection`) o más abajo, nunca como protagonista de la home.

## 1. Sección "Primera Edición" (galería + finalistas) — ✅ hecho

Probablemente la sección más importante de la web una vez que haya obras
confirmadas. Convierte al Mundial en archivo, no solo en concurso.

- Banner "MUNDIAL DE COLLAGE 2026" con contador de obras recibidas (dato
  real, calculado de los datos — nunca inventado).
- Grid de 50 finalistas, cada uno con: imagen, nombre, país, título de la obra.
- Página propia por obra (`/obras/[slug]`): imagen, artista, país, título,
  técnica, Instagram/web (solo si el artista autoriza).

## 2. Directorio "Todos los participantes" — ✅ hecho

Con 300+ obras recibidas hay una oportunidad grande: un directorio completo
en `/participantes` (separado de la teaser-list que ya existe en la home).

- Buscador por nombre.
- Filtro por país, con conteo real por país (ej. "Argentina — 84") calculado
  de los datos, no inventado.
- Filtro por técnica.
- Cada fila: bandera + nombre + país.
- Motivo para que los propios participantes compartan la página ("Mirá,
  estoy en el Mundial de Collage") → tráfico orgánico.

## 3. "Mapa del Mundial" — ✅ hecho

Mapa geográfico real (coloreado por país según cantidad de participantes),
con ranking/leyenda al lado. Datos reales de `lib/participants.ts`, sin
librería de mapas pesada de más.

## 4. Pagos con Mercado Pago (taller + "obra mensual") — pendiente

- **Taller**: cupo de 20 personas. Falta: cuenta de Mercado Pago
  (credenciales), tabla de inscripciones en Supabase (quién pagó, cupos
  ocupados), Checkout Pro para la seña, webhook que confirme el pago server
  to server, cortar el botón de pago al llenarse los 20 cupos.
  **La seña queda en pausa por ahora** (2026-09-17) — se retoma más adelante.
- **"Obra mensual"**: todavía sin definir si es suscripción recurrente
  (Mercado Pago Preapproval, guarda medio de pago, cobro automático) o venta
  puntual que se repite cada mes (mismo Checkout Pro del taller). Definir
  esto antes de tocar código — cambia bastante la arquitectura.

## 4b. Postular más de una obra — ✅ Mercado Pago / pendiente PayPal (2026-09-26)

Cada artista participa gratis con 1 obra. Puede cargar varias (hasta 10) y
elige cuál participa en `/onboarding/obras`; para postular hasta 5 hay un
pago único de ARS 30.000 por Mercado Pago (USD 15 por PayPal cuando exista
la cuenta — hoy el botón dice "Próximamente"). Precios y límites en
`site.entries` (`lib/site.ts`); pagos en `/admin/pagos`. El aviso aparece al
cargar una obra, al registrarse con varias obras recibidas por mail y en la
confirmación — no en la home.

Pendiente: PayPal; decidir si las obras extra de quien pagó se muestran en
la galería pública (hoy solo las ve el admin/jurado).

## 5. Antes de lanzar públicamente — pendiente (2026-09-19)

- Terminar el logo definitivo y subirlo a la app (reemplaza el badge "M"
  generado en `components/site-header.tsx`).
- Subir el logo/completar la verificación en Google Auth para poder publicar
  la app (hoy el consentimiento de Google la muestra como app sin verificar).
- Limpieza de datos: sanitizar mayúsculas/minúsculas y formato en nombres y
  demás campos cargados manualmente (ver el backlog de `legacy_submissions`
  y cualquier carga futura similar).

## 6. Panel de obras: curación multi-obra y filtros — pendiente (2026-09-19)

Hoy `legacy_submissions` ya tiene un flag `selected` para elegir cuál de las
varias obras que mandó un mismo artista *antes* de registrarse es "la"
oficial (ver `supabase/migrations/20260919000000_legacy_submissions.sql` y
`/admin/obras`). Falta llevar esa misma idea a los artistas que ya se
registraron por el sitio real:

- Un artista podría terminar con más de una obra cargada, no solo en el
  backlog previo al registro — hoy `profiles` asume una sola obra por
  persona. Definir el modelo de datos antes de tocar código (¿tabla `obras`
  separada, one-to-many con `profiles`?).
- Selección de cuál obra queda como "final"/"la oficial" de cada artista,
  como decisión separada de "publicada o no en la página principal"
  (`is_public`) — son dos cosas distintas: cuál es la obra real, y si esa
  obra ya se puede mostrar al público.
- Filtros en `/admin/obras`: todos los que tengan sentido (país, técnica,
  publicada/no publicada, con/sin foto guardada en el sitio, etc.).
- Catalogar por técnica con categorías fijas en vez de texto libre: mixta,
  analógica o digital.

## 7. Suscripción y tienda — pendiente (2026-09-29)

Probablemente reemplaza/define la "obra mensual" del ítem 4.

- **Suscripción** que incluye:
  - Las tarjetas de realidad aumentada para imprimir (hoy, prototipo en
    `/ar/[slug]`: el PDF A4 con 4 tarjetas A6 sale de
    `/ar/[slug]/tarjetas`, solo con sesión iniciada y enlazado únicamente
    desde el admin).
  - Una revista mensual con packs de productos (digitales o virtuales).
- **Productos de compra única**, fuera de la suscripción.
- **Kit de collage a medida**: cada persona arma el suyo eligiendo
  productos → carrito de compras.
- Definir antes de tocar código: qué entra en la suscripción y qué se vende
  suelto, cobro recurrente (Mercado Pago Preapproval) vs. compras puntuales,
  y cómo se entregan los productos digitales.

## 7b. Preventa de la Revista 1ª Edición — ✅ armada, falta precio (2026-10-01)

Revista impresa (sale el 10 de diciembre), con las 30 finalistas y un índice
con todos los participantes. `/revista` vende por Mercado Pago Checkout Pro
(envío incluido a todo Argentina) y los pedidos con dirección se ven en
`/admin/revista`. Mientras `site.magazine.priceArs` (`lib/site.ts`) sea
`null`, la página junta mails («Avisame», contactos `aviso_revista`).

Pendiente: definir el precio por ejemplar (con envío) y avisar a la lista
de espera el día que abra.

## 8. Perfil del artista — pendiente (2026-09-29)

Una página propia de cada artista (hoy no existe: solo `/onboarding/obras`
para cargar y elegir obras). Ahí va a descargar las tarjetas de realidad
aumentada de sus obras para imprimir y repartir, en vez de tenerlas en la
página pública de la cámara. Hasta que exista, las tarjetas solo se bajan
desde `/admin/obras`.

## Cómo se construyó

Los ítems 1, 2 y 3 se scaffoldearon en paralelo, cada uno en su propio
git worktree/branch, para poder revisarlos y mergearlos por separado. Todos
arrancaron con arrays de datos vacíos (mismo patrón que `lib/participants.ts`)
y un estado "todavía no hay X" — se completan solos a medida que entran datos
reales.

## Además, fuera de este roadmap original

- **Panel admin** (`/admin`, gateado a `mundialdecollage@gmail.com` y
  `fernando.navarro.mdp@gmail.com`): contactos, plantillas y campañas de
  mail vía Resend, con link de baja automático. Ver
  `supabase/migrations/20260917000000_admin_mailing.sql`.
- **Deploy**: repo privado en GitHub (`NavarroFer/mundialdecollage`), Vercel
  conectado con deploy automático a `main`, dominio `mundialdecollage.com.ar`
  en proceso de propagación de DNS.
