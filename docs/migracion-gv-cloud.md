# Migración a GV Cloud — estado y runbook

**Estado al 23/11/2026: migración en curso.** El dominio público
mundialdecollage.com.ar todavía usa Vercel y el Supabase administrado.
La copia de prueba funciona en
https://mundialdecollage.cloud.gvenue.com.ar con el Supabase alojado en GV Cloud.
**No pausar Vercel ni el Supabase original todavía.**

Este documento es el punto de partida para otra persona o IA que retome el
trabajo. No contiene contraseñas, tokens, claves privadas ni volcados de datos.
Las credenciales viven solo en los archivos de entorno de cada servidor y en
los paneles de sus proveedores.

## Objetivo y responsables

- Mantener la URL pública mundialdecollage.com.ar y las funciones actuales.
- Sacar el costo de hosting de Vercel y del plan Pro de Supabase.
- Javier administra GV Cloud, su proxy, el Supabase alojado, DNS de Cloudflare y
  las tareas programadas del servidor. Fernando administra este repo, NIC.ar y
  las credenciales de proveedores. Se coordinan por Mensajes internos del portal
  de socios de GVenue.
- R2 sigue en Cloudflare: el bucket privado mundial-img cachea las variantes de
  /api/img y otro bucket público sirve los modelos de la galería 3D.
- Resend y Brevo siguen enviando los correos. No se pidieron casillas de correo
  en GV Cloud.

## Topología

| Componente | Producción actual | Provisoria de GV Cloud |
| --- | --- | --- |
| DNS autoritativo | Vercel: ns1.vercel-dns.com, ns2.vercel-dns.com | Zona preparada en Cloudflare; aún sin delegación en NIC.ar |
| Next.js | Vercel | Node 22.23.5, puerto interno 3101, detrás del proxy de GV Cloud |
| Supabase | Proyecto administrado jgneduoejygbqtwarynr | https://api-mundialdecollage.cloud.gvenue.com.ar |
| Base | Supabase administrado | PostgreSQL 17, acceso privado por túnel SSH |
| Auth | Google OAuth del Supabase original | GoTrue con el mismo cliente de Google y claves JWT nuevas |
| Storage | Supabase administrado | Storage alojado en GV Cloud; los seis buckets se copiaron por S3 |
| Realtime | Supabase administrado | Realtime alojado en GV Cloud |
| Cron | Cinco cron de Vercel activos | Cinco cron de GV Cloud preparados y apagados |

La provisoria usa NEXT_PUBLIC_SITE_URL=https://mundialdecollage.cloud.gvenue.com.ar.
En el pase final se debe cambiar a https://mundialdecollage.com.ar y reconstruir
Next, porque las variables NEXT_PUBLIC_ se incorporan durante el build.

## Acceso sin compartir secretos

- Tailscale y SFTP: fnavarro@100.88.213.117:22. La llave privada local está en
  ~/gvenue/id_ed25519. Nunca subirla ni copiarla al repo. La huella ED25519 del
  host confirmada por Javier es
  SHA256:EbInOEIKw5vK9Ce2BfdKLpEbMj8LF4hC7B5wrn0PQeQ.
- App: /sitios/mundialdecollage.com.ar/; entorno del servicio:
  /sitios/mundialdecollage.com.ar/.env.production. Subir solo por SFTP.
- Logs: /logs/mundialdecollage.com.ar/deploy.log y app.log.
- Tocando /sitios/mundialdecollage.com.ar/reiniciar.txt el servidor ejecuta
  npm ci, npm run build y reinicia npm start. Si el build falla, Javier indicó
  que continúa la versión anterior.
- Supabase: /LEEME-supabase.txt contiene URL, claves de API, conexión de base,
  acceso al Studio y claves S3 del destino. /supabase/auth.env contiene Google
  OAuth y SMTP. Leerlos por SFTP; no copiar sus valores a chats ni al repo.
- Túnel de la base nueva, con Tailscale activo:

~~~sh
ssh -N -L 5434:127.0.0.1:5434 -i ~/gvenue/id_ed25519 fnavarro@100.88.213.117
~~~

La conexión de la base nueva está en /LEEME-supabase.txt. El usuario pasa por
un pooler; no es superusuario. El Studio tampoco está publicado en Internet.

## Trabajo realizado y verificado

1. Se exportaron roles, schema y data del Supabase administrado. Los volcados
   temporales no están en este repo. El archivo de datos contenía 89 bloques
   COPY de auth, public y storage.
2. Se restauró la base nueva en una transacción. El target ya tenía tablas
   internas de Auth y Storage. Se omitió una concesión de roles sin permiso
   (GRANT SET ON PARAMETER log_min_messages), se quitaron dos columnas de
   bloques COPY **sin filas** incompatibles con la versión nueva
   (auth.one_time_tokens.link_token_hash y
   auth.saml_providers.dedicated_scope), y se omitieron 38 bloques COPY vacíos.
   No se deshabilitaron triggers ni se usó session_replication_role.
3. Javier verificó 3.232 auth.users, 3.644 auth.identities, seis buckets,
   2.904 storage.objects y una base de 95 MB.
4. Se copiaron los seis buckets por S3 con rclone, 2.904 archivos y
   2.426.730.301 bytes. Origen y destino coincidieron en cantidad y bytes por
   bucket. Una imagen pública de la base nueva devolvió HTTP 200. Se usó la
   autenticación S3 existente del proyecto; **no se creó una clave S3 temporal**.
5. En la base **nueva únicamente** se reemplazaron 1.877 URLs de
   public.artworks.image_url y 739 de
   public.legacy_submissions.image_url para apuntar al Storage nuevo. Luego
   quedaron cero URLs antiguas en esas columnas. Repetir este reemplazo tras
   cualquier importación final.
6. Se agregó
   https://api-mundialdecollage.cloud.gvenue.com.ar/auth/v1/callback al cliente
   OAuth “Mundial de Collage” de Google Cloud, conservando el callback anterior.
   El secreto existente se pasó directamente al /supabase/auth.env remoto sin
   guardarlo en un archivo local. Javier reinició Auth; /auth/v1/settings
   respondió 200 con Google habilitado. Fernando pudo elegir su cuenta y
   entrar en la provisoria. El Auth nuevo usa JWT distintos: cada usuario
   deberá volver a iniciar sesión una vez al pasar de proveedor.
7. Se actualizó el .env.production de la provisoria para usar la URL, anon key
   y service role key nuevas, y se reconstruyó Next. Javier puso Node 22.23.5
   solo en este servicio; /es, /en y /es/tienda responden 200 y hay consultas
   reales al PostgREST nuevo.
8. Se subieron al host y se verificaron byte a byte estos cambios del repo:
   next.config.mjs, proxy.ts,
   app/api/gallery/attention/route.ts, auth/callback/route.ts,
   obras/[slug]/certificado/route.ts, ar/[slug]/tarjetas/route.ts y
   app/api/artworks/surprise/route.ts. El resto de los cambios locales debe
   revisarse antes de un nuevo deploy.
9. El login inicialmente devolvió HTTP 400 por una cabecera Cookie mayor a
   8 KB. Javier subió LimitRequestFieldSize de Apache y
   --max-http-header-size de Node a 32768; comprobó que una Cookie de prueba
   de 20 KB da 200. La prueba posterior de Fernando pasó Google Login.

## Estado abierto antes del pase

- **Datos nuevos:** producción todavía escribe en el Supabase administrado.
  La copia nueva es una foto de la madrugada del 23/11. Hace falta detener
  temporalmente las escrituras, hacer un volcado/sincronización final de base y
  Storage, validar conteos y reescribir las URLs de Storage antes de dirigir
  tráfico real a GV Cloud. No volcar de nuevo los datos encima sin plan para
  claves duplicadas y dependencias; coordinar con Javier una restauración
  limpia o un procedimiento de delta. Mantener el origen como respaldo. Una
  verificación posterior encontró 2.909 objetos en Storage de origen frente a
  los 2.904 de la primera copia; dos buckets ya difieren.
- **Correo entrante de webhooks:** resuelto el 23/11/2026 en la provisoria.
  RESEND_WEBHOOK_SECRET y BREVO_WEBHOOK_SECRET se cargaron en el
  .env.production remoto con scripts/gvcloud/webhook_secrets_bridge.py (SFTP,
  sin guardar valores) y se reinició la app (build 20261123-083131). Los dos
  handlers de la provisoria responden 401 sin firma ni token. El webhook de
  Resend que corresponde está en la cuenta todoesfanzineable, que es la que
  tiene el dominio mundialdecollage.com.ar; estaba deshabilitado y se
  habilitó. El de Brevo (mundial-campanas-estadisticas, autenticación Token)
  conserva su token. **Falta** probar con un evento real después del cambio de
  DNS. La cuenta fernavarro2607 de Resend tiene un webhook que apunta al mismo
  endpoint pero no tiene el dominio de Mundial: conviene borrarlo o
  redirigirlo. SUPABASE_USAGE_ALERT_TOKEN ya no hace falta.
  ANTHROPIC_WORKSPACE_ID y RESEND_DOMAIN_API_KEY siguen vacíos; revisar si
  alguna función usada en producción los necesita.
- **Cron de infraestructura:** se subieron
  app/api/cron/infra/route.ts y lib/supabase-monitor.ts a GV Cloud. El build
  20261123-075405 terminó OK. La nueva versión comprueba Auth, PostgREST y
  Storage propios; todavía falta probar el cron cuando se habiliten las tareas
  en la ventana de pase. Las seis pruebas de lib/supabase-monitor.test.ts
  pasaron localmente.
- **R2 galería 3D:** el bucket público que sirve
  pub-cc9f1b711e3a411ea54304f5fd60d7d5.r2.dev responde 200 y permite el
  origen https://mundialdecollage.com.ar, pero no envía
  Access-Control-Allow-Origin para la URL provisoria. Chrome informó CORS para
  archivos avatars/v1/*.glb. Fernando finalmente vio las obras; confirmar que
  los avatares 3D también se ven. Agregar la provisoria a la política CORS de
  **ese bucket público**, conservando el origen final, si se necesita probarlos
  allí. Es un bucket distinto de mundial-img. El acceso a Cloudflare se hace
  con el perfil Chrome Fernando.
- **Scripts de Vercel:** Analytics y Speed Insights ya se retiraron del código
  (rama chore/gv-cloud-cutover). Clarity es independiente y sigue funcionando.
- **Pagos y Realtime:** falta probar un flujo de Mercado Pago y PayPal sin
  completar cobros reales, los callbacks/webhooks, la tienda exterior y una
  suscripción Realtime en el host nuevo.
- **CI:** en la rama chore/gv-cloud-cutover, ci.yml quedó solo con los checks
  (lint, tsc, tests, build) y se borró supabase-migrations.yml, que apuntaba al
  project ref del Supabase administrado. Ya no hay deploy a Vercel ni migraciones
  automáticas: las migraciones al Supabase de GV Cloud se aplican a mano. Mergear
  esta rama a main recién después del pase (o justo antes del primer push).
- **Código local:** al 23/11 la rama main tenía cambios sin commit. Los dos
  archivos del monitor que diferían de GV Cloud ya se subieron. Confirmar
  git status antes de tocar otra cosa.

## DNS y cambio de tráfico

mundialdecollage.com.ar se compró en NIC.ar. La delegación pública seguía en
ns1.vercel-dns.com y ns2.vercel-dns.com al revisar este documento. Javier
preparó una zona de 23 registros en su Cloudflare, incluidos Brevo, Resend,
DMARC, verificación de Google y CAA. Los registros de correo quedan DNS only.
Los registros web @ y * de esa zona **todavía apuntan a Vercel**.

Javier confirmó que el primer paso es reemplazar en NIC.ar los nameservers por:

~~~text
marlowe.ns.cloudflare.com
nitin.ns.cloudflare.com
~~~

Ese cambio, con @ y * todavía en Vercel, permite activar y comprobar la zona
sin mover la app. Se enviaron los nameservers desde NIC.ar, pero al reabrir el
trámite seguían figurando los de Vercel y la consulta pública a 1.1.1.1
también seguía devolviendo Vercel. **No dar la delegación por completada
hasta verificarla.** Al 23/11 08:39 el panel de
NIC.ar ya listaba marlowe.ns.cloudflare.com y nitin.ns.cloudflare.com, pero
el .ar (a.lactld.org) seguía publicando los de Vercel. La zona de Cloudflare
sí responde: @ devuelve IPs de Vercel y no hay MX. Verificar con
dig +trace +nodnssec NS mundialdecollage.com.ar. El segundo
paso, coordinado con Javier, es:

1. Resolver los pendientes anteriores. Preparar HTTPS de apex y www en GV
   Cloud. Hacer la sincronización final con escrituras pausadas.
2. Cambiar NEXT_PUBLIC_SITE_URL al dominio final y reconstruir Next. Comprobar
   redirects, URLs absolutas de pagos, certificados, tarjetas y OAuth.
3. Javier cambia @ y * al nuevo servidor con proxy Cloudflare, caché de
   /api/img* y /_next/static/*, e inyecta x-vercel-ip-country. Verificar en
   respuestas reales país, Cache-Control y el HIT del CDN.
4. Apagar los cron de Vercel y encender los de GV Cloud en la misma ventana.
   Los cron de Vercel siguen ejecutándose aunque el DNS ya no apunte allí.
5. Probar login, galería/avatares, subida y lectura de Storage, tienda,
   pagos/callbacks, webhooks de mail, Realtime y admin. Confirmar desde fuera
   que www, apex, HTTPS y todos los registros de mail siguen resolviendo.
6. Mantener Vercel y Supabase administrado disponibles durante la
   estabilización. Si hay que volver a Vercel, Javier puede revertir @ y *;
   reconciliar cualquier dato escrito en la base nueva antes de volver a
   permitir escrituras en la vieja.

Los cinco horarios actuales de vercel.json son UTC:

| Ruta | Horario |
| --- | --- |
| /api/cron/registro | 0 */2 * * * |
| /api/cron/exhibition | 5 12 * * * |
| /api/cron/campanas | 10 12 * * * |
| /api/cron/certificados | 15 0 * * * |
| /api/cron/infra | 20 12 * * * |

GV Cloud debe llamarlos con Authorization: Bearer CRON_SECRET. No ejecutar
/api/cron/registro como prueba: su handler puede modificar datos aunque se le
pase dry=1.

## Limpieza y costo al terminar

- Retirar de Vercel la variable extra SUPABASE_DB_PASSWORD que se agregó para
  el volcado; la app no la usa. No pegar su valor en ningún documento.
- Una vez comprobado el tráfico en GV Cloud, desactivar los cron y el pipeline
  viejo, y recién entonces pausar/cancelar los servicios pagos. No borrar la
  base vieja antes de comprobar respaldo y reconciliación.
- Borrar los volcados SQL y copias locales de LEEME-supabase.txt, auth.env y
  .env.production que quedaron temporalmente en
  /private/tmp/gvcloud-migrate-gj136jqq/. No borrar los archivos de entorno
  **remotos** que necesita la app. Cerrar el túnel SSH al terminar.
- Revisar que ningún secreto, dump, archivo .env o llave privada haya quedado
  agregado a Git. Los scripts versionados en scripts/gvcloud/ no deben
  contener valores.

## Scripts de esta migración

Los scripts originales de trabajo estuvieron en
/private/tmp/gvcloud-migrate-gj136jqq/ y se deben borrar al finalizar.
Las versiones saneadas y reutilizables se guardan en
[scripts/gvcloud/](../scripts/gvcloud/README.md): copia y verificación de
Storage por S3, ajuste del dump, reemplazo de URLs de Storage, despliegue por
SFTP y transferencia de OAuth sin archivo local. Requieren que el operador
provea rutas locales y credenciales por archivos privados o prompts, nunca
por argumentos de línea de comandos o Git.

## Cómo desplegar a GV Cloud (después del pase)

Producción corre en GV Cloud. Mergear a `main` solo corre los checks del CI:
no despliega nada. El deploy se hace a mano, desde la computadora de
Fernando, con Tailscale conectado:

1. Juntar los cambios en una rama, abrir PR a `main` y esperar el CI verde.
2. Mergear y actualizar: `git checkout main && git pull`.
3. Desplegar: `~/.venvs/gv/bin/python3 scripts/gvcloud/deploy.py`.

El script exige estar en `main`, sin cambios sin commitear y igual a
`origin/main`. Compara contra el commit guardado en el servidor
(`.deployed-commit`), lista los archivos a subir y a borrar, pide confirmación,
sube, toca `reiniciar.txt` y espera el `OK: build` del `deploy.log`. Si el
build falla, el commit marcado como desplegado no cambia. `--dry-run` solo
muestra el plan. No toca `.env.production`: las claves y `NEXT_PUBLIC_SITE_URL`
(`https://mundialdecollage.com.ar`) quedan como están en el servidor.

Primera vez, para decirle qué commit corre hoy el servidor (el del pase,
`81dbff5` en la rama chore/gv-cloud-cutover o su equivalente en `main`):

~~~sh
~/.venvs/gv/bin/python3 scripts/gvcloud/deploy.py --mark-deployed 81dbff5
~~~

`sync_code.py` queda para comparar todo el repo contra el servidor (tarda unos
20 minutos) cuando se sospecha que el servidor se desvió del código.

## Migraciones nuevas

El CI ya no aplica migraciones. Para una migración nueva de
`supabase/migrations/`:

1. Abrir el túnel: `ssh -N -L 5434:127.0.0.1:5434 -i ~/gvenue/id_ed25519 fnavarro@100.88.213.117`.
2. Aplicarla **antes** de desplegar el código que la necesita:
   `psql "$DB_URI" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/<archivo>.sql`
   (`DB_URI` sale de la línea `postgresql://...` de `/LEEME-supabase.txt`).
3. No usar `supabase db push`: la base de GV Cloud no tiene el historial de
   migraciones del proyecto viejo (el dump del pase solo incluyó datos de
   `auth`, `public` y `storage`) y intentaría repetirlas todas.
