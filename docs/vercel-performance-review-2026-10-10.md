# Revisión de transferencia y rendimiento — 10 de octubre de 2026

Revisión enfocada en consumo de Vercel después del cambio a Pro.

## Base medida

Vercel Metrics, proyecto `mundialdecollage`, métrica
`vercel.function_invocation.fot_total_bytes`, agregación `sum`, agrupada por
`route`, ventana de siete días consultada el 10 de octubre. GB decimales.
La ventana incluye despliegues anteriores; no representa solamente la versión actual.
La consulta por proyecto no equivale a la captura de 30 días de todos los proyectos.

| Ruta | Fast Origin Transfer en 7 días |
| --- | ---: |
| `/api/img` | 2,77 GB |
| `/obras/[slug]/opengraph-image` | 648 MB |
| `/[locale]/anon/obras/[slug]` | 362 MB |
| `/monitoring/[...path]` | 271 MB |

Fast Origin Transfer mide CDN ↔ funciones, no las descargas directas de Supabase
o R2 ni toda la transferencia hacia visitantes.

## Mejoras implementadas

- `components/obras-collage.tsx` y `components/depth-carousel.tsx`: variantes
  responsivas con `srcSet` y `sizes`. Antes todas las tarjetas pedían 828px,
  aunque muchas se muestran alrededor de 225–300px. El navegador ahora elige
  una variante según tamaño y densidad de pantalla; en pantallas de alta
  densidad puede seguir necesitando la variante grande.
- `app/api/img/route.ts`: ETag del WebP resultante y respuestas 304 ante
  `If-None-Match`. Si una imagen vencida sigue igual, se reutiliza el cuerpo
  local. Conserva el plazo de actualización de fotos mutables. La validación
  todavía puede consultar R2 y ejecutar la función; reduce bytes de respuesta,
  no elimina todo el trabajo de origen.
- `app/[locale]/layout.tsx`: integración oficial de
  `@vercel/speed-insights/next` v2 para medir rendimiento real.

## Optimizaciones que ya estaban presentes

- Fotos redimensionadas y convertidas a WebP en `/api/img`.
- Originales y derivados guardados en R2; fuentes versionadas con caché larga.
- Copias anónimas de páginas públicas e invalidación de datos publicados.
- `/api/obras` prerenderizada con revalidación de 60 segundos, confirmado en
  el manifiesto de prerender existente.
- Caché para el loader de Clarity y desactivación de prefetch en enlaces de obras.

## Próximos focos

1. Comparar métricas por ruta en una ventana posterior al despliegue y
   revisar HIT/MISS de `/api/img`; el ahorro real todavía no está medido.
2. Investigar la distribución por URL/ancho y las texturas de la galería 3D:
   carga las obras a 1080px. Una carga por cercanía puede reducir descargas,
   pero requiere validar recorrido, aparición de cuadros y memoria GPU.
3. Evaluar entregar derivados desde un dominio público de R2/CDN: la caché
   privada actual evita repetir transformaciones, pero cada miss de Vercel
   todavía devuelve los bytes desde una función. Requiere configurar dominio
   y publicación de derivados.
4. Revisar imágenes Open Graph y Clarity en una ventana reciente antes de
   cambiar políticas de caché o cobertura de analítica.

Speed Insights empezará a recopilar visitas una vez desplegada la integración.
