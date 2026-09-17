# Roadmap

Notas de producto para las próximas etapas del sitio (post feedback de Fer,
2026-09-16). No son features urgentes — son la dirección para cuando haya
obras y participantes reales.

## Principio: no promocionar el taller antes de tiempo

No poner el taller/curso arriba de todo en la home. Primero hay que construir
prestigio alrededor del Mundial en sí mismo — el taller es secundario hasta
que el evento tenga tracción propia. Mantener `WorkshopSection` donde está
(después de `AboutSection`) o más abajo, nunca como protagonista de la home.

## 1. Sección "Primera Edición" (galería + finalistas)

Probablemente la sección más importante de la web una vez que haya obras
confirmadas. Convierte al Mundial en archivo, no solo en concurso.

- Banner "MUNDIAL DE COLLAGE 2026" con contador de obras recibidas (dato
  real, calculado de los datos — nunca inventado).
- Grid de 50 finalistas, cada uno con: imagen, nombre, país, título de la obra.
- Página propia por obra (`/obras/[slug]`): imagen, artista, país, título,
  técnica, Instagram/web (solo si el artista autoriza).

## 2. Directorio "Todos los participantes"

Con 300+ obras recibidas hay una oportunidad grande: un directorio completo
en `/participantes` (separado de la teaser-list que ya existe en la home).

- Buscador por nombre.
- Filtro por país, con conteo real por país (ej. "Argentina — 84") calculado
  de los datos, no inventado.
- Filtro por técnica.
- Cada fila: bandera + nombre + país.
- Motivo para que los propios participantes compartan la página ("Mirá,
  estoy en el Mundial de Collage") → tráfico orgánico.

## 3. "Mapa del Mundial"

Visualización de dónde viene la comunidad. Arranca como un ranking/leyenda
por país (bandera + país + cantidad, con los mismos datos reales de
participantes) para no sumar una librería de mapas pesada sin necesidad.
Un mapa ilustrado con pines es una mejora visual futura, una vez que haya
un asset de diseño para eso.

## Cómo se está construyendo

Los ítems 1, 2 y 3 se scaffoldean en paralelo, cada uno en su propio
git worktree/branch, para poder revisarlos y mergearlos por separado. Todos
arrancan con arrays de datos vacíos (mismo patrón que `lib/participants.ts`
hoy) y un estado "todavía no hay X" — se completan solos a medida que entran
datos reales.
