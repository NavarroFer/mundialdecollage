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

# PayPal subscriptions (USD). Keep the client secret server-only. Create the
# three plans with `node scripts/paypal-setup.mjs` after first setting the
# credentials; it prints the plan IDs below. Register
# https://your-domain/api/paypal/webhook in PayPal with: BILLING.SUBSCRIPTION.ACTIVATED,
# BILLING.SUBSCRIPTION.UPDATED, BILLING.SUBSCRIPTION.CANCELLED,
# BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED,
# BILLING.SUBSCRIPTION.PAYMENT.FAILED, PAYMENT.SALE.COMPLETED,
# PAYMENT.SALE.REFUNDED, PAYMENT.SALE.REVERSED, PAYMENT.CAPTURE.COMPLETED,
# PAYMENT.CAPTURE.REFUNDED and PAYMENT.CAPTURE.REVERSED.
# PAYPAL_ENV=sandbox
# PAYPAL_CLIENT_ID=
# PAYPAL_CLIENT_SECRET=
# NEXT_PUBLIC_PAYPAL_CLIENT_ID=  # same value as PAYPAL_CLIENT_ID
# PAYPAL_WEBHOOK_ID=
# PAYPAL_PLAN_ID_INICIAL=        # USD 10/month
# PAYPAL_PLAN_ID_MIEMBRO=        # USD 36/month
# PAYPAL_PLAN_ID_SOCIO_PREMIUM=  # USD 82/month
# BRAND_NAME="Mundial de Collage"

# Anthropic (Claude) — https://platform.claude.com/settings/keys. Traduce
# solas las plantillas de mail a los 8 idiomas del sitio al guardarlas (ver
# lib/email-translator.ts). Sin esto, las plantillas se guardan igual y las
# que no tengan traducción se envían en español a todos.
# ANTHROPIC_API_KEY=

# Microsoft Clarity — https://clarity.microsoft.com, creá un proyecto para el
# dominio del sitio y copiá el Project ID (Settings > Setup). Sin esto no se
# inyecta ningún script (ver components/clarity.tsx). Da heatmaps de clicks,
# mapas de scroll y grabaciones de sesión; no se carga en /admin.
# NEXT_PUBLIC_CLARITY_PROJECT_ID=
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

## Idiomas

El sitio público está en español, inglés, portugués, italiano, francés,
alemán, ruso, polaco e indonesio (los idiomas de los países participantes).
Cada visitante lo ve en el idioma de su navegador; si no es uno de esos, en
el de su país (Vercel geolocaliza la IP) y si no, en español. El selector del
header/footer guarda la elección en una cookie, y un link con `?lang=it` (o
`en`, `pt`, …) abre el sitio directamente en ese idioma.

- **Textos**: [lib/i18n/messages/](lib/i18n/messages/) — `es.ts` es la fuente y
  el resto se tipan contra ese archivo, así que una clave faltante rompe el build.
- **Qué idioma por país**: [lib/i18n/locales.ts](lib/i18n/locales.ts).
- Quedan solo en español: el panel admin, las páginas del taller (presencial en
  Mar del Plata, pago en pesos), los Términos/Privacidad (con un aviso en el
  idioma del lector) y el PDF de bases.
- **Mails**: cada plantilla se traduce sola al guardarla (requiere
  `ANTHROPIC_API_KEY`) y al enviar una campaña cada contacto recibe la versión
  del idioma de su país (sacado de su perfil o del Registro; sin país, español).

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
- **Participantes, finalistas y conteo de obras**: ya no son arrays mockeados
  — se leen en vivo de la tabla `profiles` en Supabase
  ([lib/participants.ts](lib/participants.ts), [lib/finalists.ts](lib/finalists.ts),
  [lib/submissions.ts](lib/submissions.ts)). El dato real es cada inscripción
  hecha desde `/onboarding` (ver más abajo).

## Login e inscripción

Google login vía Supabase Auth (`lib/supabase/`). Después de loguearse, el
onboarding en `app/onboarding/` funciona como el formulario de inscripción al
Mundial: nombre, país, técnica (opcional), título de la obra, imagen (sube a
Supabase Storage, bucket `artworks`) e instagram/web (opcional). Se guarda
todo en `profiles`, pero **queda oculta hasta que un admin la publique**
desde `/admin/obras` (grilla estilo Fotos de iPhone: tocá para seleccionar
varias, "Estas participan" las hace públicas). Recién ahí aparece en el
directorio de participantes, el mapa y `/edicion-2026`. El campo
`is_public` (ver `supabase/migrations/20260918000000_profile_visibility.sql`)
es la barrera real — un trigger en la tabla la protege incluso de un usuario
que intente setearla directo por API, no solo la UI del panel. Todo el flujo
está gateado por `isSupabaseConfigured`
([lib/supabase/config.ts](lib/supabase/config.ts)) — sin credenciales reales,
el sitio se comporta exactamente como la versión sin login.

## Pendiente

- Real bases PDF → `public/docs/bases-mundial-de-collage.pdf`.
- Confirmar y cargar el Instagram real en `lib/site.ts` (`instagram`).
- Sumar nombres/fotos del jurado en `components/jury-section.tsx` cuando se
  confirmen.
- Anunciar los premios cuando estén definidos.
- Precio del taller + credenciales de Mercado Pago para conectar el checkout
  real (la utilidad de "aumentar el precio según la comisión" ya está en
  `lib/pricing.ts`, falta el formulario/admin que la use).
