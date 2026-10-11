# Acceso y atención en la galería

La galería requiere una cuenta de Google desde la primera visita. La página
verifica la sesión en el servidor antes de obtener las obras y montar el juego.
La copia anónima del CDN sirve únicamente la pantalla de ingreso. OAuth conserva
el idioma y los parámetros del enlace (obra, invitación o acción pendiente).
Crear una cuenta para visitar no exige enviar una obra.

## Qué se mide

- `view`: el centro de la cámara intersecta la imagen de una obra a un máximo de
  5 metros. La primera superficie visible debe ser esa imagen: una pared u otro
  objeto que la tape impiden contar tiempo. No es seguimiento ocular ni cuenta
  las obras que se ven de reojo.
- `details`: tiempo consultando la ficha. Tiene prioridad sobre `view`; nunca se
  suma el mismo intervalo en ambas categorías.
- Se requieren 2 segundos continuos para registrar un tramo. Al alcanzarlos se
  incluyen esos primeros 2 segundos. El intervalo de muestreo es 250 ms.
- No se cuenta mientras la pestaña está oculta, sin foco, en un menú, en una
  orientación móvil incompatible o después de 60 segundos sin actividad.
  Las suspensiones del temporizador de más de un segundo tampoco suman tiempo.
- `episodes` cuenta tramos sostenidos, no visitas únicas ni necesariamente
  regresos intencionales. Una pausa y una reanudación pueden originar otro tramo.
- Límite: 4 horas acumuladas por sesión. Los contadores son estimaciones de
  atención y no demuestran preferencia.

## Guardado

El navegador envía acumulados cada 30 segundos, al ocultar/salir de la página y
al desmontar la galería en una navegación interna. Los últimos segundos pueden
perderse si el navegador se cierra de golpe o no hay red. No se guarda una cola
persistente ni un historial de movimientos.

El servidor exige mismo origen, valida el tamaño y contenido, y verifica la
cuenta con Supabase Auth. El `accountId` enviado solo sirve para rechazar una
cola de una cuenta anterior: la atribución usa siempre la sesión verificada.

La función SQL conserva el mayor acumulado recibido para cada
sesión/obra/categoría. Reintentar una entrega o recibirla fuera de orden no duplica
segundos. Las sesiones están ligadas a una cuenta, expiran para escrituras tras
24 horas y se limitan a 200 nuevas por cuenta y día, con 40 filas por sesión.
Los borrados de cuenta y obra eliminan los datos asociados por cascada.

Los datos individuales están protegidos con RLS: solo administradores pueden
leerlos; únicamente el servidor puede escribir. Los visitantes y artistas no
pueden consultar el historial de otra persona. El panel muestra agregados por
obra y conserva la separación entre observación y lectura de fichas.

## Activación

1. Aplicar `supabase/migrations/20261011180000_gallery_attention.sql` mediante el
   procedimiento de migraciones del proyecto.
2. Desplegar el código. Requiere las mismas variables de Supabase y clave de
   servicio que ya usa el sitio.
3. Con una cuenta de prueba, observar una obra durante más de 2 segundos,
   consultar su ficha y salir. Verificar los contadores en
   `/admin/estadisticas` y que recargar/reintentar no duplique acumulados.
4. Comprobar manualmente el regreso de OAuth con un enlace compartido, la
   salida de sesión y el recorrido en escritorio y móvil.

`next dev` valida peticiones pero no escribe atención en la base compartida de
producción. Si falta la migración, el endpoint devuelve 503 y el panel informa
que la medición no está disponible; recorrer la galería sigue funcionando.

Los ajustes y obras abiertas siguen guardándose localmente por navegador; no
se sincronizan con la cuenta. El seguimiento nuevo sí se atribuye por cuenta.
