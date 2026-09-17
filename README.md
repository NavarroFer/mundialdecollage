# Mundial Internacional de Collage

Landing page + login/onboarding para el Mundial Internacional de Collage. Next.js
(App Router) + Tailwind v4 + shadcn/ui + Supabase Auth, siguiendo la misma base
que el resto de los proyectos del workspace (ver `cursiva`, `studio`).

## Desarrollo

```bash
npm install
npm run dev
```

## Variables de entorno

No hay `.env.example` en el repo (las reglas de permisos de este entorno
bloquean escribir archivos `.env*`) — creá `.env.local` a mano con esto:

```bash
# Supabase — https://supabase.com/dashboard/project/_/settings/api-keys
# Sin esto, el botón de login no aparece y el sitio funciona exactamente
# como antes (ver lib/supabase/config.ts). También hace falta habilitar el
# provider de Google en Supabase Auth, con
# https://<tu-dominio>/auth/callback como redirect URL autorizada.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend — https://resend.com/api-keys. Sin esto, /admin/campanas no puede
# mandar mails (ver lib/resend.ts). Requiere mundialdecollage.com.ar
# verificado como sending domain en Resend (ver mailFrom en lib/site.ts).
RESEND_API_KEY=

# Opcional: fuerza la URL usada en links de mail (ej. unsubscribe) en vez de
# auto-detectar la URL de Vercel (ver getSiteUrl en lib/site.ts).
# NEXT_PUBLIC_SITE_URL=

# Mercado Pago — recién hace falta cuando el taller tenga precio real
# (ver lib/pricing.ts).
# MERCADOPAGO_ACCESS_TOKEN=
# NEXT_PUBLIC_MP_PUBLIC_KEY=
# MERCADOPAGO_WEBHOOK_SECRET=
```

Una vez creado el proyecto de Supabase, corré la migración en
`supabase/migrations/` (Supabase CLI o pegada directo en el SQL editor) para
crear la tabla `profiles`.

### Migraciones automáticas (CI)

El workflow [.github/workflows/supabase-migrations.yml](.github/workflows/supabase-migrations.yml)
aplica las migraciones pendientes de `supabase/migrations/` contra el
proyecto de producción cada vez que se pushea a `main` (en paralelo al
deploy automático de Vercel). Requiere estos secrets en GitHub (Settings →
Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN`: personal access token,
  https://supabase.com/dashboard/account/tokens
- `SUPABASE_DB_PASSWORD`: la contraseña de la base (Settings → Database del
  proyecto)

El project ref ya está hardcodeado en el workflow
(`jgneduoejygbqtwarynr`) porque no es un dato sensible.

## Editar contenido

- **Fecha límite, email de contacto, tagline, datos del taller**:
  [lib/site.ts](lib/site.ts).
- **Secciones de la página**: cada bloque vive en su propio archivo en
  [components/](components/) (`hero-section`, `bases-banner`, `how-to-section`,
  `about-section`, `workshop-section`, `participants-section`, `jury-section`,
  `cta-section`, `footer`) y se arma en [app/page.tsx](app/page.tsx).
- **Colores de marca** (papel, tinta, azul/rojo/mostaza del collage): tokens
  `--paper`, `--ink`, `--collage-blue`, `--collage-red`, `--collage-yellow` en
  [app/globals.css](app/globals.css).
- **Participantes** (nombre + bandera): array `participants` en
  [lib/participants.ts](lib/participants.ts).

## Login y onboarding

Google login vía Supabase Auth (`lib/supabase/`), con onboarding post-login en
`app/onboarding/` que pide nombre + ubicación y los guarda en la tabla
`profiles`. Todo el flujo está gateado por `isSupabaseConfigured`
([lib/supabase/config.ts](lib/supabase/config.ts)) — sin credenciales reales,
el sitio se comporta exactamente como la versión sin login.

## Pendiente

- Real bases PDF → `public/docs/bases-mundial-de-collage.pdf`.
- Confirmar y cargar el Instagram real en `lib/site.ts` (`instagram`).
- Sumar nombres/fotos del jurado en `components/jury-section.tsx` cuando se
  confirmen.
- Anunciar los premios cuando estén definidos.
- Crear el proyecto de Supabase y cargar las credenciales de arriba.
- Precio del taller + credenciales de Mercado Pago para conectar el checkout
  real (la utilidad de "aumentar el precio según la comisión" ya está en
  `lib/pricing.ts`, falta el formulario/admin que la use).
