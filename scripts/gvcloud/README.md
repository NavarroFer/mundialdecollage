# Scripts de la migración a GV Cloud

Leé primero [el runbook](../../docs/migracion-gv-cloud.md). Estos archivos son
versiones saneadas de los programas usados el 23/11/2026. No contienen claves
ni contraseñas. Se ejecutan **desde la computadora de Fernando**, con Tailscale
conectado cuando usan SSH o PostgreSQL. No se ejecutan dentro del servidor.

Dependencias: Python 3.10+, rclone para Storage, y los paquetes Python
paramiko (SFTP), pg8000 (base) y boto3 solo si se consulta R2 directamente.
Instalarlos en un entorno virtual local fuera del repo. No subir ese entorno.

| Archivo | Uso | Cambia datos |
| --- | --- | --- |
| storage_copy.py | Preflight, copia S3 por bucket y comparación de conteos/bytes | Solo con --apply |
| prepare_data_dump.py | Descarta COPY vacíos del dump de Supabase para el target | Escribe un SQL temporal |
| rewrite_storage_urls.py | Cuenta y reemplaza URLs públicas de Storage en la base nueva | Solo con --apply |
| sync_code.py | Compara el código de git con el servidor y sube lo que difiere (solo lectura sin --apply); no toca .env.production ni dispara el build | Solo con --apply |
| deploy.py | Despliega main: sube solo lo que cambió desde el último deploy (git diff), aplica antes las migraciones nuevas de `supabase/migrations/` (túnel SSH + psql, una transacción por archivo, registro en `.migrations-applied`), reconstruye y espera el OK del log; exige el CI del commit en verde (espera si está corriendo; `--sin-ci` solo para una urgencia); pide confirmación; `--no-migrate` las saltea | Sí, al confirmar |
| deploy_provisional.py | Sube los archivos de código elegidos, actualiza cuatro claves de .env.production y dispara el build | Solo con --apply |
| oauth_bridge.py | Pasa client ID y secret de Google desde un formulario local al auth.env remoto por SFTP | Sí, al enviar el formulario |

## Archivos privados de entrada

- La .env.local **existente** del proyecto contiene las claves del origen; no
  agregarla a Git. storage_copy.py usa su anon key y service role key como
  credenciales de sesión S3 del origen, tal como se hizo en esta migración.
- El remoto /LEEME-supabase.txt se puede bajar a una carpeta temporal privada,
  modo 600, para que los scripts lean las claves del destino. Borrarlo luego.
- El remoto /supabase/auth.env y la app .env.production **deben permanecer en
  el servidor**. No versionar copias.
- El archivo known_hosts debe contener la huella SSH ED25519 verificada con
  Javier. Nunca usar StrictHostKeyChecking=no.
- No pasar secretos en argumentos de la línea de comandos, URLs de navegador,
  comentarios, chats ni logs.

## Secuencia original

1. Sacar roles.sql, schema.sql y data.sql desde el Supabase administrado con la
   CLI de Supabase. Los tres son sensibles y deben quedar fuera del repo.
2. Restaurar schema.sql en el PostgreSQL nuevo por el túnel de Tailscale.
   roles.sql solo contenía ajustes de timeout y un GRANT sin permiso en el
   target; se omitió. El target ya traía Auth y Storage.
3. Ejecutar prepare_data_dump.py sobre data.sql y restaurar su salida en una
   transacción. La salida usada en esta migración contenía los 51 bloques
   COPY con filas; omitía 38 bloques vacíos. Confirmar errores y conteos.
4. Ejecutar storage_copy.py primero sin --apply para medir, después con
   --apply para copiar, y otra vez con --verify para comparar.
5. Ejecutar rewrite_storage_urls.py primero sin --apply y después con --apply.
6. Configurar Google Cloud OAuth y pasar el secreto con oauth_bridge.py.
7. Ejecutar deploy_provisional.py con rutas explícitas, --site-url de la
   provisoria y --apply. Verificar deploy.log y la web en un navegador.

**El dump inicial ya se restauró.** Esta secuencia no se debe repetir encima
de la base en uso: los COPY contienen IDs existentes. Para el pase final hay
que acordar con Javier un refresco limpio o un delta mientras se pausan las
escrituras de producción.

Ejemplos sin secretos en la línea de comandos:

~~~sh
python3 scripts/gvcloud/prepare_data_dump.py \
  --input /ruta/privada/data.sql --output /ruta/privada/data-gv.sql

python3 scripts/gvcloud/storage_copy.py \
  --source-env /ruta/privada/.env.local \
  --target-info /ruta/privada/LEEME-supabase.txt

python3 scripts/gvcloud/storage_copy.py \
  --source-env /ruta/privada/.env.local \
  --target-info /ruta/privada/LEEME-supabase.txt --apply

python3 scripts/gvcloud/rewrite_storage_urls.py \
  --target-info /ruta/privada/LEEME-supabase.txt

python3 scripts/gvcloud/deploy_provisional.py \
  --target-info /ruta/privada/LEEME-supabase.txt \
  --known-hosts /ruta/privada/known_hosts \
  --ssh-key ~/gvenue/id_ed25519 \
  --site-url https://mundialdecollage.cloud.gvenue.com.ar \
  --file next.config.mjs --file proxy.ts --apply
~~~

Antes de cada --apply, confirmar que el origen y el destino son los previstos.
Después borrar todos los archivos SQL, copias de LEEME, temporales de SFTP y
datos sensibles locales al terminar la migración.
