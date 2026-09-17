# Mundial Internacional de Collage

Landing page de convocatoria para el Mundial Internacional de Collage. Next.js (App
Router) + Tailwind v4 + shadcn/ui, siguiendo la misma base que el resto de los
proyectos landing del workspace.

## Desarrollo

```bash
npm install
npm run dev
```

## Editar contenido

- **Fecha límite, email de contacto, tagline**: [lib/site.ts](lib/site.ts).
- **Secciones de la página**: cada bloque vive en su propio archivo en
  [components/](components/) (`hero-section`, `how-to-section`, `jury-section`,
  `cta-section`, `footer`) y se arma en [app/page.tsx](app/page.tsx).
- **Colores de marca** (papel, tinta, azul/rojo/mostaza del collage): tokens
  `--paper`, `--ink`, `--collage-blue`, `--collage-red`, `--collage-yellow` en
  [app/globals.css](app/globals.css).

## Pendiente

- Confirmar y cargar el Instagram real en `lib/site.ts` (`instagram`).
- Sumar nombres/fotos del jurado en `components/jury-section.tsx` cuando se
  confirmen.
- Anunciar los premios en la misma sección cuando estén definidos.
