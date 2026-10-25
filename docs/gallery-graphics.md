# Calidad gráfica adaptable de la galería

Implementado el 24/10/2026 en `codex/gallery-adaptive-graphics`. Sin despliegue ni cambios en producción. Se mantiene Three.js/WebGL con React Three Fiber y Rapier; no se incorporan dependencias ni recursos remotos.

## Auditoría inicial enfocada en gráficos

Referencias de líneas del estado previo al cambio (`git show 205051e:<archivo>`):

| Prioridad | Evidencia | Problema observable | Resolución |
| --- | --- | --- | --- |
| P2 | `components/gallery/Scene.tsx:54–55` | DPR y sombras elegidos solo por dispositivo táctil; un portátil lento sigue pagando VSM mientras cae el FPS. | Cuatro niveles, detección conservadora y regulador por tiempos de cuadro. |
| P2 | `components/gallery/world/Lighting.tsx:29–39` | Shadow map 2048 y blur de 16 muestras fijos, sin presupuesto por equipo. | Un único sol con PCF soportado por Three r186, sin pasadas de desenfoque VSM; 0/1024/2048/4096. |
| P2 | `components/gallery/world/Rooms.tsx:175` y `world/Architecture.tsx:237` | Texturas procedurales propias sin liberación explícita al cambiar de tema. | Cleanup de texturas, mapas de detalle y probe de reflejos. |
| P3 | `components/gallery/world/architectureTextures.ts:88` | Anisotropía fija en 8 sin tener en cuenta capacidad/preset. | 1/2/4/8 limitada por el renderer. |
| P3 | `components/gallery/world/Rooms.tsx:184` | Superficies sin microrelieve y luz ambiente plana. | Bump/roughness neutros pequeños y luz hemisférica; reflejos indirectos de baja intensidad en Alto/Ultra. |

Fortalezas conservadas: Canvas diferido hasta entrar, renderizado bajo demanda con menú, geometrías arquitectónicas fusionadas, texturas de obras redimensionadas para móvil, carga cacheada, imágenes sRGB con `meshBasicMaterial toneMapped={false}`. No se añaden bloom, filtros de color, niebla ni postprocesado global sobre las obras. La resolución de presentación sí puede variar al bajar DPR; no cambia la imagen original ni su tratamiento cromático.

## Presets

| Nivel | DPR máximo | Shadow map | Microrelieve/reflejos | Anisotropía | Visitantes decorativos máximos |
| --- | ---: | ---: | --- | ---: | ---: |
| Bajo | 0.85 | desactivado | no | 1 | 2 |
| Medio | 1.15 | 1024² | no | 2 | 3 |
| Alto | 1.5 | 2048² | sí | 4 | 5 |
| Ultra | 2 | 4096² | sí | 8 | 5 |

Los visitantes reales no se eliminan por calidad. Al cambiar de nivel pueden aparecer/desaparecer visitantes decorativos. Se preservan controles, cámara, colliders, posición del jugador, máquinas y audio.

La resolución está limitada a 2 millones de píxeles en táctiles y 8 millones en escritorio; nunca excede el DPR nativo. En táctiles las sombras se limitan a 2048² aun seleccionando Ultra; también se respeta `maxTextureSize`. Las obras siguen usando sus derivados de 828/1080 px sin recargarlos al fluctuar los FPS. Los mapas procedurales adicionales son de 128², sin descargas. El probe PMREM se genera una vez al activar Alto/Ultra, resolución 128, intensidad 0.18; no es un espejo en tiempo real ni iluminación global física.

## Detección y adaptación

- Usa concurrencia de CPU, memoria cuando el navegador la informa, tipo de entrada y límite WebGL. No consulta identidad de GPU ni transmite estos datos.
- <=2 núcleos, <=2 GB o texturas <4096: Bajo. Táctiles, <=4 núcleos/GB o concurrencia desconocida: Medio. Resto: Alto. Nunca inicia automáticamente en Ultra.
- Ventanas de 3 segundos usando tiempos reales de cuadro, con 5 segundos iniciales de calentamiento.
- Dos ventanas <42 FPS bajan un nivel; diez ventanas >57 FPS suben uno. Después del cambio espera 12 segundos. Esto proporciona histéresis, no garantiza 60 FPS en cualquier dispositivo.
- Automático permite subir hasta Alto en táctiles y Ultra en escritorio. Una selección explícita es el techo; desactivar el checkbox fija ese nivel (con los límites de hardware).
- Menús, carga inicial y pestañas ocultas no participan de la medición. Cambiar configuración, reanudar o volver a la pestaña reinicia la medición. Saltos de tiempo >0.5s se descartan como suspensión.
- Canvas y física se pausan al ocultar la pestaña. No se monta nuevamente la escena para cambiar calidad.

## Menú y persistencia

En las preferencias de la visita, disponibles antes de entrar y en el menú del recorrido: **Calidad gráfica**, selección Automático/Bajo/Medio/Alto/Ultra, ajuste dinámico y nivel actual/última medición de FPS. Textos en los nueve idiomas del sitio. Controles nativos con etiquetas y área táctil mínima de 44 px.

Solo selección y checkbox se guardan en `mdc-gallery-graphics-v1`; no se persisten FPS ni decisiones temporales. Los datos inválidos o el almacenamiento bloqueado vuelven a valores seguros. La detección se hace cuando existe el renderer, sin abrir un segundo contexto WebGL antes de entrar.

## Verificación y límites

- Pruebas de detección, límites de píxeles, datos persistidos, almacenamiento bloqueado, histéresis, calentamiento, suspensión, techo manual y mínimo Bajo.
- 864 pruebas en 149 archivos pasaron; TypeScript y ESLint sin errores.
- Build local con `npm run build -- --webpack`: completado. El build predeterminado con Turbopack falla en este entorno al abrir un puerto auxiliar (`Operation not permitted`); no se cambió la configuración de producción para esquivarlo. La primera ejecución restringida también falló descargando Google Fonts.
- Comprobación visual local de los cuatro niveles y los tres temas usando World real, física, arquitectura, visitantes y cartas de color sintéticas en los lugares de las obras. Ruta temporal de prueba eliminada antes de entregar; no hubo acceso ni escritura a contenido de producción.
- Sin errores WebGL en consola. Avisos existentes de Three.Clock y parámetros de inicialización de Rapier permanecen en dependencias.
- No es un benchmark de teléfonos físicos: falta medir una visita larga en iPhone/Safari y Android de gama baja, con obras reales y temperatura sostenida. No se afirma una ganancia porcentual ni FPS garantizados. Los avatares reales y la cantidad de obras siguen teniendo coste incluso en Bajo.

Para validar en dispositivos reales: entrar con Automático, recorrer las tres salas, abrir/cerrar menús y cambiar de pestaña; verificar que el nivel se estabilice y no baje por el menú. Probar cada preset con adaptación desactivada, volver a Automático, recargar y comprobar persistencia. Comparar la misma obra con su imagen 2D; verificar que luz/sombra solo afecten marco y entorno. Repetir los temas, el juego y la consola de música.

Referencia del motor: [R3F — Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance). La implementación instalada de Three r186 elimina PCFSoftShadowMap; se usa PCFShadowMap mediante `shadows="percentage"`. No se utiliza la opción de sombras obsoleta.
