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
