// Mundial de Collage — lectura de mails y carga de la planilla de Registro.
//
// Corre en Apps Script, vinculado a la planilla: pegar este archivo entero en
// Extensiones → Apps Script, reemplazando el código anterior (si quedan dos
// archivos con las mismas constantes, Apps Script no arranca). Después:
//   1. Ejecutar configurarActivador() una vez: deja un activador cada 10 min.
//   2. Opcional, recomendado: Configuración del proyecto → Propiedades del
//      script → ANTHROPIC_API_KEY. Con la clave, Claude lee cada correo y
//      extrae nombre, país, título e Instagram; sin ella se usan solo las
//      reglas de este archivo, que además validan lo que devuelve Claude.
//      probarClaude() verifica la clave con un correo de ejemplo.
//   3. simularReparacion() muestra en la pestaña "Simulación" qué cambiaría
//      en Registro, sin escribir nada. repararRegistro() lo aplica.
//
// Cada corrida:
//   - procesa los correos nuevos (obra → fila en Registro y acuse; consulta →
//     bases o pestaña de consultas), y
//   - repara filas de Registro con datos faltantes o mal extraídos, releyendo
//     los correos del artista. Es idempotente por columna: una celda que
//     corregiste a mano no se pisa (si el script propone otra cosa, lo deja
//     como sugerencia en "Revisar"); una vacía, con un valor provisorio
//     ("Sin especificar", "No informado"…) o con lo que escribió el script,
//     se completa o corrige. Para que vuelva a extraer un campo, vaciá la
//     celda. reiniciarReparacion() hace revisar todas las filas otra vez.
//
// La columna D (link de Drive) es la clave con la que el sitio identifica la
// obra: el script nunca la cambia, salvo para dejar un solo link donde
// quedaron varios juntos (el sitio ya usaba el primero).

const NOMBRE_CARPETA_OBRAS = "Mundial de Collage 2026 - Obras Recibidas";
const ETIQUETA_PROCESADO = "Mundial-Procesado";
const ETIQUETA_ERROR = "Mundial-Error";
const CUENTA_PROPIA = "mundialdecollage@gmail.com";
const INSTAGRAM_PROPIOS = ["tehacefaltacollage_", "tehacefaltacollage", "mundialdecollage"];
const TAMANO_MINIMO_ADJUNTO_BYTES = 40 * 1024; // descarta logos de firmas
const HILOS_POR_CORRIDA = 12;
const LIMITE_CORRIDA_MS = 4.5 * 60 * 1000; // Apps Script corta a los 6 min
const VERSION_EXTRACTOR = 3;
const MODELO_CLAUDE = "claude-opus-5";
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const REMITENTES_IGNORAR = [
  "no-reply", "noreply", "mailer-daemon", "postmaster", "notifications", "bounces",
  "@google.com", "higgsfield.ai", "cosmos.so", CUENTA_PROPIA,
];
const EXTENSIONES_VALIDAS = [".jpg", ".jpeg", ".png", ".heic", ".heif", ".pdf", ".tiff", ".tif", ".webp"];

// Columnas de Registro (1-based). A–E las lee el sitio: no cambiar su orden.
const COL = { nombre: 1, pais: 2, email: 3, obra: 4, titulo: 5, instagram: 6, correo: 7, fecha: 8, revisar: 9, meta: 10 };
const ENCABEZADOS_EXTRA = { 5: "Titulo", 6: "Instagram", 7: "Correo", 8: "Fecha", 9: "Revisar", 10: "Datos del script (no editar)" };
const CAMPOS = ["nombre", "pais", "titulo", "instagram"];
const ETIQUETAS_CAMPO = { nombre: "nombre", pais: "país", titulo: "título", instagram: "Instagram" };
const PLACEHOLDERS = {
  nombre: ["sin nombre"],
  pais: ["sin especificar", "no especificado", "no informado", "a revisar", "s/d", "-"],
  titulo: ["sin titulo", "s/t", "-"],
  instagram: ["no informado", "no tengo", "-", "@"],
};

// ============================================================
// PUNTOS DE ENTRADA
// ============================================================

// La que corre el activador.
function procesarMailsEntrantes() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // otra corrida sigue en curso
  const inicio = Date.now();
  try {
    const ctx = abrirContexto();
    procesarHilosNuevos(ctx, inicio);
    repararRegistro_(ctx, inicio);
  } finally {
    lock.releaseLock();
  }
}

// Para correr a mano desde el editor: solo la reparación de filas.
function repararRegistro() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    repararRegistro_(abrirContexto(), Date.now());
  } finally {
    lock.releaseLock();
  }
}

// Vuelve a revisar todas las filas (por ejemplo, después de agregar la clave
// de Claude o de cambiar reglas). Nunca pisa lo corregido a mano.
function reiniciarReparacion() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("reparar:ronda", String(Number(props.getProperty("reparar:ronda") || 0) + 1));
  props.deleteProperty("reparar:fila");
}

// Para probar la clave de Claude desde el editor: muestra en el registro de
// ejecución lo que extrae de un correo de ejemplo.
function probarClaude() {
  const clave = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!clave) throw new Error("Falta la propiedad del script ANTHROPIC_API_KEY");
  const ejemplo = {
    getPlainBody: () => "Hola! Soy de Rosario y les mando mi obra.\nMi obra se llama “Raíces de papel”.\nIG: instagram.com/ana.collage\n\nSaludos,\nAna Pérez",
  };
  const datos = extraerConClaude(clave, armarEntrada("Ana <ana@example.com>", "Postulación", [ejemplo], ["IMG_1234.jpg"]));
  if (!datos) throw new Error("Claude no respondió: mirá el registro de ejecución");
  Logger.log(JSON.stringify(datos, null, 2));
}

function configurarActivador() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "procesarMailsEntrantes")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("procesarMailsEntrantes").timeBased().everyMinutes(10).create();
}

// Muestra en la pestaña "Simulación" qué cambiaría la reparación, sin
// escribir nada en Registro. Si el registro de ejecución dice que quedaron
// filas, volver a ejecutarla: sigue desde donde quedó.
function simularReparacion() {
  const inicio = Date.now();
  const ctx = abrirContexto(true);
  const reales = ctx.props;
  const empieza = !reales.getProperty("simular:fila");
  const cambios = [];
  ctx.hojaRegistro = hojaSimulada(ctx.hojaRegistro, cambios);
  ctx.props = {
    getProperty: k => reales.getProperty(k === "reparar:fila" ? "simular:fila" : k),
    setProperty: (k, v) => { if (k === "reparar:fila") reales.setProperty("simular:fila", v); },
    deleteProperty: () => {},
  };
  repararRegistro_(ctx, inicio);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const informe = ss.getSheetByName("Simulación") || ss.insertSheet("Simulación");
  if (empieza) informe.clear();
  if (informe.getLastRow() === 0) informe.appendRow(["Fila", "Columna", "Antes", "Después"]);
  if (cambios.length) informe.getRange(informe.getLastRow() + 1, 1, cambios.length, 4).setValues(cambios.map(c => c.map(celdaSegura)));
  const completa = Date.now() - inicio <= LIMITE_CORRIDA_MS;
  if (completa) reales.deleteProperty("simular:fila");
  Logger.log(`${cambios.length} cambios propuestos en la pestaña Simulación. ${completa ? "Se revisaron todas las filas." : "Quedaron filas: volvé a ejecutar simularReparacion."}`);
}

const NOMBRES_COLUMNAS = ["Nombre", "País", "Email", "Obra", "Título", "Instagram", "Correo", "Fecha", "Revisar", "Datos del script"];

// Copia en memoria de la hoja: la reparación corre igual, pero los cambios
// se anotan en vez de escribirse.
function hojaSimulada(hoja, cambios) {
  const columnas = Math.min(hoja.getMaxColumns(), COL.meta);
  const valores = hoja.getLastRow() === 0 ? [] : hoja.getRange(1, 1, hoja.getLastRow(), columnas).getDisplayValues()
    .map(f => f.concat(new Array(COL.meta - columnas).fill("")));
  const leer = (fila, col, filas, cols) => valores.slice(fila - 1, fila - 1 + (filas || 1)).map(f => f.slice(col - 1, col - 1 + (cols || 1)));
  return {
    getLastRow: () => valores.length,
    getMaxColumns: () => COL.meta,
    getRange: (fila, col, filas, cols) => ({
      getDisplayValues: () => leer(fila, col, filas, cols),
      getValues: () => leer(fila, col, filas, cols),
      setValue: valor => {
        const nuevo = String(valor == null ? "" : valor).replace(/^'/, "");
        const antes = valores[fila - 1][col - 1];
        if (antes !== nuevo && col !== COL.meta) cambios.push([fila, NOMBRES_COLUMNAS[col - 1], antes, nuevo]);
        valores[fila - 1][col - 1] = nuevo;
      },
    }),
  };
}

function abrirContexto(simular) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaRegistro = ss.getSheetByName("Registro");
  if (!hojaRegistro) throw new Error("No existe la pestaña Registro");
  if (!simular) asegurarEncabezados(hojaRegistro);
  const carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA_OBRAS);
  const props = PropertiesService.getScriptProperties();
  return {
    hojaRegistro,
    hojaConsultas: ss.getSheetByName("Consultas y Dudas") || ss.getSheetByName("Consultas y dudas") || ss.getSheetByName("consultas"),
    carpeta: carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(NOMBRE_CARPETA_OBRAS),
    etiqueta: GmailApp.getUserLabelByName(ETIQUETA_PROCESADO) || GmailApp.createLabel(ETIQUETA_PROCESADO),
    etiquetaError: GmailApp.getUserLabelByName(ETIQUETA_ERROR) || GmailApp.createLabel(ETIQUETA_ERROR),
    props,
    claveClaude: props.getProperty("ANTHROPIC_API_KEY"),
    emailsRegistrados: obtenerEmailsRegistrados(hojaRegistro),
  };
}

function asegurarEncabezados(hoja) {
  if (hoja.getMaxColumns() < COL.meta) hoja.insertColumnsAfter(hoja.getMaxColumns(), COL.meta - hoja.getMaxColumns());
  const actuales = hoja.getRange(1, 1, 1, COL.meta).getValues()[0];
  Object.keys(ENCABEZADOS_EXTRA).forEach(col => {
    const actual = String(actuales[col - 1] || "").trim();
    if (!actual || /^columna \d+$/i.test(actual)) hoja.getRange(1, Number(col)).setValue(ENCABEZADOS_EXTRA[col]);
  });
  if (!hoja.isColumnHiddenByUser(COL.meta)) hoja.hideColumns(COL.meta);
}

// ============================================================
// CORREOS NUEVOS
// ============================================================

function procesarHilosNuevos(ctx, inicio) {
  const sinProcesar = GmailApp.search(`in:inbox -label:${ETIQUETA_PROCESADO} -label:${ETIQUETA_ERROR}`, 0, HILOS_POR_CORRIDA);
  // Gmail puede heredarle la etiqueta del hilo a una respuesta nueva, así que
  // los hilos ya procesados con actividad reciente se revisan aparte.
  const conActividad = GmailApp.search(`label:${ETIQUETA_PROCESADO} -label:${ETIQUETA_ERROR} newer_than:3d`, 0, 50)
    .filter(h => h.getLastMessageDate().getTime() > Number(ctx.props.getProperty("hilo:" + h.getId()) || 0));
  const vistos = {};
  const pendientes = sinProcesar.map(h => [h, false]).concat(conActividad.map(h => [h, true]));
  for (const [hilo, yaEtiquetado] of pendientes) {
    if (Date.now() - inicio > LIMITE_CORRIDA_MS) return;
    if (vistos[hilo.getId()]) continue;
    vistos[hilo.getId()] = true;
    try {
      procesarHilo(ctx, hilo, yaEtiquetado);
      hilo.addLabel(ctx.etiqueta);
    } catch (err) {
      // Un hilo que falla queda marcado para revisar a mano en vez de
      // reintentarse (y duplicar archivos) en cada corrida.
      Logger.log(`Error en hilo ${hilo.getId()}: ${(err && err.stack) || err}`);
      hilo.addLabel(ctx.etiquetaError);
      registrarConsulta(ctx, "", `Error del script: ${(err && err.message) || err}`, "", "Revisar a mano", hilo.getId());
    }
    hilo.markRead();
    Utilities.sleep(300);
  }
}

// Atiende solo lo que el artista escribió desde la última vez: mensajes
// posteriores a lo ya procesado y a nuestra última respuesta en el hilo.
function procesarHilo(ctx, hilo, yaEtiquetado) {
  const mensajes = hilo.getMessages();
  const claveProp = "hilo:" + hilo.getId();
  const procesadoHasta = Number(ctx.props.getProperty(claveProp) || 0);
  const ultimaFecha = String(mensajes[mensajes.length - 1].getDate().getTime());
  let ultimoNuestro = 0;
  mensajes.forEach(m => {
    if (extraerEmail(m.getFrom()) === CUENTA_PROPIA) ultimoNuestro = Math.max(ultimoNuestro, m.getDate().getTime());
  });
  // Hilo que procesó la versión anterior del script, que no anotaba hasta
  // dónde había leído: si no le respondimos, no se sabe qué es nuevo.
  if (yaEtiquetado && !procesadoHasta && !ultimoNuestro) {
    ctx.props.setProperty(claveProp, ultimaFecha);
    return;
  }
  const desde = Math.max(procesadoHasta, ultimoNuestro);
  const nuevos = mensajes.filter(m => m.getDate().getTime() > desde && !esRemitenteIgnorado(extraerEmail(m.getFrom())));
  if (nuevos.length > 0) atenderMensajes(ctx, hilo, nuevos, ultimoNuestro > 0);
  ctx.props.setProperty(claveProp, ultimaFecha);
}

function atenderMensajes(ctx, hilo, nuevos, yaRespondimos) {
  const ultimo = nuevos[nuevos.length - 1];
  const email = extraerEmail(ultimo.getFrom());
  const delArtista = nuevos.filter(m => extraerEmail(m.getFrom()) === email);
  const adjuntos = [];
  delArtista.forEach(m => m.getAttachments().forEach(a => { if (esAdjuntoDeObra(a)) adjuntos.push(a); }));
  const entrada = armarEntrada(ultimo.getFrom(), hilo.getFirstMessageSubject(), delArtista, adjuntos.map(a => a.getName()));
  const resumen = entrada.textos.join(" ").replace(/\s+/g, " ").trim().substring(0, 150);
  const registrado = ctx.emailsRegistrados.has(email);

  if (adjuntos.length > 0 && !registrado) {
    registrarObra(ctx, hilo, email, adjuntos, entrada);
    responder(ultimo, CUERPO_CONFIRMACION_OBRA);
    return;
  }
  if (registrado) {
    // Puede traer datos que faltaban o una corrección: la fila se vuelve a
    // leer en la reparación de esta misma corrida (sin pisar lo hecho a mano).
    marcarParaRevisar(ctx, email);
  }
  if (adjuntos.length > 0) {
    const links = adjuntos.map((a, i) => guardarAdjunto(ctx, a, `REENVÍO ${entrada.remitenteNombre || email}${adjuntos.length > 1 ? ` (${i + 1})` : ""}`));
    registrarConsulta(ctx, entrada.remitenteNombre, `Reenvió ${adjuntos.length} imagen(es): ${links.join(" , ")} — ${resumen}`, email, "Ya inscripto: revisar a mano", hilo.getId());
  } else if (esSoloAgradecimiento(resumen)) {
    // "¡Gracias!" no necesita respuesta.
  } else if (registrado || yaRespondimos) {
    registrarConsulta(ctx, entrada.remitenteNombre, resumen, email, "Responder a mano", hilo.getId());
  } else {
    const enviado = responder(ultimo, CUERPO_BASES);
    registrarConsulta(ctx, entrada.remitenteNombre, resumen, email, enviado ? "Bases enviadas" : "Error al enviar bases", hilo.getId());
  }
}

function registrarObra(ctx, hilo, email, adjuntos, entrada) {
  const datos = extraerDatos(ctx, entrada);
  const nombre = datos.nombre || email.split("@")[0];
  const principal = Math.min(Math.max(Number(datos.imagen_principal) || 0, 0), adjuntos.length - 1);
  const orden = [principal].concat(adjuntos.map((_, i) => i).filter(i => i !== principal));
  const base = `${nombre}${datos.titulo ? " - " + datos.titulo : ""}`;
  const links = orden.map((i, n) => guardarAdjunto(ctx, adjuntos[i], orden.length > 1 ? `${base} (${n + 1})` : base));

  const valores = { nombre, pais: datos.pais, titulo: datos.titulo, instagram: datos.instagram };
  const meta = { ver: versionExtractor(ctx), auto: valores, extras: links.slice(1), hilo: hilo.getId() };
  const fila = new Array(COL.meta).fill("");
  CAMPOS.forEach(c => { fila[COL[c] - 1] = valores[c]; });
  fila[COL.email - 1] = email;
  fila[COL.obra - 1] = links[0];
  fila[COL.correo - 1] = urlHilo(hilo.getId());
  fila[COL.fecha - 1] = Utilities.formatDate(new Date(), ZONA_HORARIA, "dd/MM/yyyy HH:mm");
  fila[COL.revisar - 1] = notasDeRevision(datos, meta, fila).join("; ");
  fila[COL.meta - 1] = JSON.stringify(meta);
  ctx.hojaRegistro.appendRow(fila.map((v, i) => (i === COL.fecha - 1 ? v : celdaSegura(v))));
  ctx.emailsRegistrados.add(email);
}

function marcarParaRevisar(ctx, email) {
  const hoja = ctx.hojaRegistro;
  const ultima = hoja.getLastRow();
  if (ultima < 2) return;
  hoja.getRange(2, 1, ultima - 1, COL.meta).getDisplayValues().forEach((fila, i) => {
    if (String(fila[COL.email - 1] || "").toLowerCase().trim() !== email) return;
    const meta = leerMeta(fila[COL.meta - 1]);
    meta.forzar = true;
    hoja.getRange(i + 2, COL.meta).setValue(JSON.stringify(meta));
  });
}

function esAdjuntoDeObra(adjunto) {
  const nombre = adjunto.getName().toLowerCase();
  const tipo = String(adjunto.getContentType() || "").toLowerCase();
  const formatoValido = EXTENSIONES_VALIDAS.some(ext => nombre.endsWith(ext)) || tipo.indexOf("image/") === 0 || tipo === "application/pdf";
  return formatoValido && adjunto.getSize() >= TAMANO_MINIMO_ADJUNTO_BYTES;
}

function guardarAdjunto(ctx, adjunto, base) {
  const archivo = ctx.carpeta.createFile(adjunto);
  archivo.setName(`${base.replace(/[\/\\?%*:|"<>]/g, "").trim()} - ${adjunto.getName()}`);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/file/d/${archivo.getId()}/view`;
}

function responder(mensaje, cuerpo) {
  try {
    mensaje.reply(cuerpo, { name: "Mundial de Collage" });
    return true;
  } catch (err) {
    Logger.log(`No se pudo responder a ${mensaje.getFrom()}: ${err.message}`);
    return false;
  }
}

function registrarConsulta(ctx, nombre, mensaje, email, estado, idHilo) {
  if (!ctx.hojaConsultas) return;
  const fecha = Utilities.formatDate(new Date(), ZONA_HORARIA, "dd/MM/yyyy HH:mm");
  ctx.hojaConsultas.appendRow([celdaSegura(nombre), celdaSegura(mensaje), email, estado, idHilo ? urlHilo(idHilo) : "", fecha]);
}

function esSoloAgradecimiento(texto) {
  const t = normalizar(texto).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return String(texto).indexOf("?") < 0 && t.length <= 40 &&
    /^(muchas |mil )?(gracias|thanks|thank you|obrigad[ao]|genial|perfecto|excelente|buenisimo|ok|dale|listo)\b/.test(t);
}

function urlHilo(id) {
  return `https://mail.google.com/mail/u/0/#all/${id}`;
}

// ============================================================
// REPARACIÓN DE FILAS EXISTENTES
// ============================================================

function repararRegistro_(ctx, inicio) {
  const hoja = ctx.hojaRegistro;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  const valores = hoja.getRange(2, 1, ultimaFila - 1, COL.meta).getDisplayValues();
  const version = versionExtractor(ctx);
  // Retoma donde quedó la corrida anterior: con muchas filas pendientes, la
  // reparación se reparte entre varias corridas.
  let fila = Number(ctx.props.getProperty("reparar:fila") || 2);
  if (!(fila >= 2 && fila <= ultimaFila)) fila = 2;

  for (let revisadas = 0; revisadas < valores.length; revisadas++) {
    if (Date.now() - inicio > LIMITE_CORRIDA_MS) break;
    const actual = valores[fila - 2];
    const meta = leerMeta(actual[COL.meta - 1]);
    const conDatos = actual[COL.email - 1] || actual[COL.obra - 1];
    const pendientes = conDatos ? camposPendientes(actual, meta, version) : [];
    const necesita = pendientes.length > 0 || meta.forzar || tieneVariosLinks(actual[COL.obra - 1]) || paisNormalizado(actual[COL.pais - 1]);
    if (conDatos && necesita) {
      try {
        repararFila(ctx, fila, actual, meta, pendientes, version);
      } catch (err) {
        Logger.log(`Error reparando fila ${fila}: ${(err && err.stack) || err}`);
        meta.ver = version; // no reintentar en cada corrida; vaciar una celda lo reintenta
        delete meta.forzar;
        hoja.getRange(fila, COL.revisar).setValue(celdaSegura(`Error del script: ${(err && err.message) || err}`));
        hoja.getRange(fila, COL.meta).setValue(JSON.stringify(meta));
      }
    }
    fila = fila >= ultimaFila ? 2 : fila + 1;
  }
  ctx.props.setProperty("reparar:fila", String(fila));
}

// Campos que el script puede tocar y que además necesitan trabajo.
function camposPendientes(fila, meta, version) {
  return CAMPOS.filter(campo => {
    const valor = String(fila[COL[campo] - 1] || "").trim();
    if (!esEditable(campo, valor, meta, fila)) return false;
    if (meta.forzar) return true;
    // Ya revisada con esta versión: solo si alguien vació la celda a mano
    // (no si ya estaba vacía porque el correo no traía el dato).
    if (meta.ver === version) return valor === "" && !(meta.auto && meta.auto[campo] === "");
    // Versión o ronda nueva (por ejemplo, recién se agregó la clave de
    // Claude): se vuelve a extraer todo lo que escribió el script.
    const delScript = Boolean(meta.auto) && Object.prototype.hasOwnProperty.call(meta.auto, campo);
    return delScript || valor === "" || esPlaceholder(campo, valor) || !esValido(campo, valor, fila);
  });
}

// Una celda es del script si está vacía, tiene un valor provisorio, o
// conserva exactamente lo que el script escribió la última vez. En filas sin
// historial (cargadas a mano o por la versión anterior), un valor que parece
// correcto se considera cargado a mano.
function esEditable(campo, valor, meta, fila) {
  if (valor === "" || esPlaceholder(campo, valor)) return true;
  const auto = meta.auto || {};
  if (Object.prototype.hasOwnProperty.call(auto, campo)) return valor === String(auto[campo] || "");
  return !esValido(campo, valor, fila);
}

function repararFila(ctx, numFila, actual, meta, pendientes, version) {
  const hoja = ctx.hojaRegistro;
  const fila = actual.slice();
  const escribir = (col, valor) => {
    hoja.getRange(numFila, col).setValue(celdaSegura(valor));
    fila[col - 1] = valor;
  };
  const email = String(fila[COL.email - 1] || "").toLowerCase().trim();
  meta.auto = meta.auto || {};
  const notas = [];
  let datos = null;

  if (tieneVariosLinks(fila[COL.obra - 1])) {
    const links = String(fila[COL.obra - 1]).match(/https:\/\/drive\.google\.com\/[^\s,]+/g) || [];
    escribir(COL.obra, links[0]);
    meta.extras = unicos((meta.extras || []).concat(links.slice(1)));
  }
  const pais = paisNormalizado(fila[COL.pais - 1]);
  if (pais) {
    const eraDelScript = meta.auto.pais !== undefined && String(meta.auto.pais) === String(fila[COL.pais - 1]).trim();
    escribir(COL.pais, pais);
    if (eraDelScript) meta.auto.pais = pais;
  }

  if (pendientes.length > 0) {
    const fuente = buscarMensajesDelArtista(fila[COL.correo - 1], meta.hilo, email);
    if (!fuente) {
      notas.push("No encontré el correo original");
    } else {
      meta.hilo = fuente.hiloId;
      datos = extraerDatos(ctx, armarEntrada(fuente.remitente, fuente.asunto, fuente.mensajes, fuente.adjuntos));
      CAMPOS.forEach(campo => {
        const valor = String(fila[COL[campo] - 1] || "").trim();
        const propuesto = datos[campo] || "";
        if (!esEditable(campo, valor, meta, fila)) {
          if (propuesto && normalizar(propuesto) !== normalizar(valor)) notas.push(`Sugerencia ${ETIQUETAS_CAMPO[campo]}: ${propuesto}`);
          return;
        }
        // Sin propuesta nueva se conserva lo que había, salvo un título o un
        // Instagram que está mal (por ejemplo "de la obra" o el título en la
        // columna de Instagram): esos se vacían.
        let nuevo = propuesto;
        if (!nuevo && (campo === "nombre" || campo === "pais" || esPlaceholder(campo, valor) || esAceptable(campo, valor, fila))) nuevo = valor;
        if (nuevo !== valor) escribir(COL[campo], nuevo);
        meta.auto[campo] = nuevo;
      });
      if (!fila[COL.correo - 1]) escribir(COL.correo, urlHilo(fuente.hiloId));
    }
  }

  delete meta.forzar;
  meta.ver = version;
  escribir(COL.revisar, unicos(notas.concat(notasDeRevision(datos, meta, fila))).join("; "));
  hoja.getRange(numFila, COL.meta).setValue(JSON.stringify(meta));
}

// Todos los mensajes que mandó el artista: el hilo de la obra y cualquier
// otro hilo suyo (una corrección puede llegar en un correo aparte).
function buscarMensajesDelArtista(linkCorreo, hiloGuardado, email) {
  if (!email) return null;
  const hilos = [];
  const agregar = h => { if (h && !hilos.some(o => o.getId() === h.getId())) hilos.push(h); };
  const idLink = String(linkCorreo || "").match(/#[a-z]+\/([A-Za-z0-9]+)\s*$/);
  [hiloGuardado, idLink && idLink[1]].forEach(id => {
    if (!id) return;
    try { agregar(GmailApp.getThreadById(id)); } catch (err) { /* hilo borrado */ }
  });
  GmailApp.search(`from:(${email})`, 0, 5).forEach(agregar);

  const mensajes = [];
  const adjuntos = [];
  let hiloObra = null;
  let hiloAlguno = null;
  hilos.forEach(h => h.getMessages().forEach(m => {
    if (extraerEmail(m.getFrom()) !== email) return;
    mensajes.push(m);
    hiloAlguno = hiloAlguno || h;
    const deObra = m.getAttachments().filter(esAdjuntoDeObra);
    deObra.forEach(a => adjuntos.push(a.getName()));
    if (deObra.length && !hiloObra) hiloObra = h;
  }));
  if (mensajes.length === 0) {
    // Postulaciones que nos reenviaron: el artista no es el remitente, pero su
    // correo aparece en el texto reenviado.
    GmailApp.search(`"${email}" -from:(${email})`, 0, 3).forEach(h => h.getMessages().forEach(m => {
      if (String(m.getPlainBody() || "").toLowerCase().indexOf(email) < 0) return;
      mensajes.push(m);
      hiloAlguno = hiloAlguno || h;
      const deObra = m.getAttachments().filter(esAdjuntoDeObra);
      deObra.forEach(a => adjuntos.push(a.getName()));
      if (deObra.length && !hiloObra) hiloObra = h;
    }));
  }
  if (mensajes.length === 0) return null;
  mensajes.sort((a, b) => a.getDate().getTime() - b.getDate().getTime());
  const principal = hiloObra || hiloAlguno;
  return {
    hiloId: principal.getId(),
    remitente: mensajes[mensajes.length - 1].getFrom(),
    asunto: principal.getFirstMessageSubject(),
    mensajes,
    adjuntos,
  };
}

function leerMeta(texto) {
  try {
    const meta = JSON.parse(texto || "{}");
    return meta && typeof meta === "object" ? meta : {};
  } catch (err) {
    return {};
  }
}

// "USA", "Mexico", "Buenos Aires, Argentina" → el nombre que reconoce el
// sitio. Es el mismo país, así que se aplica también a lo cargado a mano.
function paisNormalizado(valor) {
  const v = String(valor || "").trim();
  const pais = v && !esPlaceholder("pais", v) ? paisCanonico(v) : null;
  return pais && pais !== v ? pais : null;
}

function tieneVariosLinks(valor) {
  return (String(valor || "").match(/drive\.google\.com/g) || []).length > 1;
}

function versionExtractor(ctx) {
  return `${VERSION_EXTRACTOR}.${ctx.props.getProperty("reparar:ronda") || 0}${ctx.claveClaude ? "c" : "r"}`;
}

function notasDeRevision(datos, meta, fila) {
  const notas = [];
  const v = campo => String(fila[COL[campo] - 1] || "").trim();
  if (!v("nombre")) notas.push("Falta nombre");
  else if (!esValido("nombre", v("nombre"), fila)) notas.push("Revisar nombre");
  if (!v("pais") || esPlaceholder("pais", v("pais"))) notas.push("Falta país");
  else if (!esValido("pais", v("pais"), fila)) notas.push("Revisar país");
  if (!v("titulo")) notas.push("Falta título");
  else if (!esAceptable("titulo", v("titulo"), fila)) notas.push("Revisar título");
  if (datos && datos.dudas) notas.push(datos.dudas);
  if (meta.extras && meta.extras.length) notas.push(`Otras imágenes: ${meta.extras.join(" , ")}`);
  return notas;
}

// ============================================================
// EXTRACCIÓN
// ============================================================

function armarEntrada(remitente, asunto, mensajes, nombresAdjuntos) {
  const crudos = mensajes.map(m => String(m.getPlainBody() || ""));
  return {
    remitenteNombre: extraerNombre(remitente),
    email: extraerEmail(remitente),
    asunto: String(asunto || ""),
    crudos,
    textos: crudos.map(quitarCitas),
    adjuntos: nombresAdjuntos || [],
  };
}

// Claude cuando hay clave; las reglas siempre, como respaldo campo por campo.
function extraerDatos(ctx, entrada) {
  const reglas = extraerConReglas(entrada);
  const ia = ctx.claveClaude ? extraerConClaude(ctx.claveClaude, entrada) : null;
  if (!ia) return reglas;
  const resultado = { imagen_principal: Number(ia.imagen_principal) || 0, dudas: String(ia.dudas || "").trim() };
  CAMPOS.forEach(campo => {
    const bruto = String(ia[campo] == null ? "" : ia[campo]).trim();
    const limpio = limpiarCampo(campo, bruto, true);
    if (limpio && (campo === "pais" || esAceptable(campo, limpio, null, { nombre: ia.nombre }))) resultado[campo] = limpio;
    else if (!bruto && campo !== "nombre") resultado[campo] = ""; // Claude no lo encontró: no adivinar
    else resultado[campo] = reglas[campo];
  });
  resultado.titulo = pulirTitulo(resultado.titulo, resultado.nombre);
  return resultado;
}

const PROMPT_CLAUDE = `Leés correos de artistas que se postulan a la convocatoria del Mundial Internacional de Collage. Te paso el remitente, el asunto, los nombres de los archivos adjuntos y lo que escribió el artista, en orden cronológico y ya sin las citas de nuestras respuestas.

Extraé:
- nombre: el nombre con el que el artista quiere figurar (nombre y apellido o nombre artístico). No uses firmas institucionales, cargos, saludos ni texto de nuestra plantilla, como "Tu nombre completo (o nombre artístico)". Si solo aparece en el remitente o en el nombre del archivo, tomalo de ahí.
- pais: el país de residencia, en español y con su nombre corto habitual ("Argentina", "México", "España", "Estados Unidos", "Brasil"). Si solo dice la ciudad, inferí el país. Si menciona dos, poné el de residencia y contá el otro en dudas.
- titulo: el título de la obra tal como lo escribió el artista, sin comillas, técnica, medidas, formato ni año. Si dice que no tiene título, poné "Sin título". Si no lo menciona, dejalo vacío: no lo inventes a partir del nombre del archivo, salvo que el archivo claramente lleve el título.
- instagram: el usuario de Instagram del artista, sin @ ni URL. Vacío si no lo informa. Nunca uses @tehacefaltacollage_, que es nuestro.
- imagen_principal: índice (desde 0) del adjunto que es la obra completa, si se distingue de detalles o fotos de proceso; si no, 0.
- dudas: una frase corta en español si algo es ambiguo o contradictorio; si no, vacío.

Si el artista corrige un dato en un mensaje posterior, usá el más reciente. Usá cadena vacía para lo que no aparezca; nunca completes con suposiciones.`;

const ESQUEMA_CLAUDE = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    pais: { type: "string" },
    titulo: { type: "string" },
    instagram: { type: "string" },
    imagen_principal: { type: "integer" },
    dudas: { type: "string" },
  },
  required: ["nombre", "pais", "titulo", "instagram", "imagen_principal", "dudas"],
  additionalProperties: false,
};

function extraerConClaude(clave, entrada) {
  const partes = [
    `Remitente: ${entrada.remitenteNombre} <${entrada.email}>`,
    `Asunto: ${entrada.asunto}`,
    `Adjuntos: ${entrada.adjuntos.map((n, i) => `[${i}] ${n}`).join(", ") || "ninguno"}`,
  ];
  entrada.textos.forEach((texto, i) => {
    partes.push("", `--- Mensaje ${i + 1} de ${entrada.textos.length} ---`, texto ? texto.substring(0, 6000) : "(sin texto)");
    // Si respondió dentro de la cita, el texto limpio queda casi vacío.
    if (texto.length < 40 && entrada.crudos[i].length > texto.length) {
      partes.push("(Texto completo con citas; la plantilla de las bases es nuestra, no del artista:)", entrada.crudos[i].substring(0, 6000));
    }
  });

  // "fallbacks" reintenta en otro modelo si el pedido se rechaza por
  // seguridad; si la cuenta no lo admite, se repite el pedido sin él.
  const pedir = conRespaldo => {
    const cuerpo = {
      model: MODELO_CLAUDE,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_CLAUDE } },
      system: PROMPT_CLAUDE,
      messages: [{ role: "user", content: partes.join("\n") }],
    };
    const encabezados = { "x-api-key": clave, "anthropic-version": "2023-06-01" };
    if (conRespaldo) {
      cuerpo.fallbacks = "default";
      encabezados["anthropic-beta"] = "server-side-fallback-2026-07-01";
    }
    return UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: encabezados,
      payload: JSON.stringify(cuerpo),
    });
  };

  try {
    let respuesta = pedir(true);
    if (respuesta.getResponseCode() === 400) respuesta = pedir(false);
    if (respuesta.getResponseCode() !== 200) {
      Logger.log(`Claude respondió ${respuesta.getResponseCode()}: ${respuesta.getContentText().substring(0, 500)}`);
      return null;
    }
    const cuerpo = JSON.parse(respuesta.getContentText());
    if (cuerpo.stop_reason !== "end_turn") {
      Logger.log(`Claude terminó con ${cuerpo.stop_reason}`);
      return null;
    }
    const bloque = (cuerpo.content || []).find(b => b.type === "text");
    return bloque ? JSON.parse(bloque.text) : null;
  } catch (err) {
    Logger.log(`Error llamando a Claude: ${err.message}`);
    return null;
  }
}

// ---------- Reglas (sin IA) ----------

function extraerConReglas(entrada) {
  const datos = { nombre: "", pais: "", titulo: "", instagram: "", imagen_principal: 0, dudas: "" };
  const acepta = (campo, valor) => {
    if (datos[campo]) return false;
    const limpio = limpiarCampo(campo, valor);
    if (!limpio || !esAceptable(campo, limpio, null, datos)) return false;
    datos[campo] = limpio;
    return true;
  };

  // Del mensaje más reciente al más viejo: una corrección posterior gana.
  for (let i = entrada.textos.length - 1; i >= 0; i--) reglasDeMensaje(entrada.textos[i], entrada.crudos[i], acepta);
  // El asunto es la fuente menos confiable.
  const asunto = entrada.asunto.replace(/^((re|rv|fw|fwd|enc)\s*:\s*)+/i, "");
  reglasDeMensaje(asunto, asunto, acepta);
  acepta("nombre", entrada.remitenteNombre);

  datos.titulo = pulirTitulo(datos.titulo, datos.nombre);
  // Último recurso para el título: el nombre del archivo, marcado para revisar.
  for (const archivo of entrada.adjuntos) {
    if (datos.titulo) break;
    if (acepta("titulo", tituloDesdeArchivo(archivo, datos.nombre || entrada.remitenteNombre))) {
      datos.dudas = "Título tomado del nombre del archivo";
    }
  }
  return datos;
}

function reglasDeMensaje(texto, crudo, acepta) {
  // 1. Respuestas a la plantilla de las bases, aunque estén dentro de la cita.
  const plantilla = extraerRespuestasAPlantilla(crudo);
  CAMPOS.forEach(c => acepta(c, plantilla[c]));

  // 2. "Etiqueta: valor", con el valor en la misma línea o en la siguiente.
  const etiquetados = extraerEtiquetados(texto);
  CAMPOS.forEach(c => (etiquetados[c] || []).forEach(v => acepta(c, v)));

  // 3. Lista numerada sin etiquetas, en el orden que piden las bases.
  const numerados = extraerNumerados(texto);
  if (numerados[2] && paisCanonico(numerados[2])) {
    acepta("nombre", numerados[1]);
    acepta("pais", numerados[2]);
    acepta("titulo", numerados[3]);
    acepta("instagram", numerados[4]);
  }

  const lineas = texto.split("\n").map(l => l.trim()).filter(Boolean);

  // 4. Frases: "me llamo X", "vivo en X", "el título es X".
  lineas.forEach(l => {
    const nombre = l.match(/\b(?:mi nombre es|me llamo|my name is|meu nome [eé])\s+([^,.;!\n]+)/i);
    if (nombre) acepta("nombre", nombre[1]);
    const pais = l.match(/\b(?:soy de|vivo en|resido en|residente en|radicad[oa] en|desde|from|sou de|moro em)\s+([^.;!\n]+)/i);
    if (pais) acepta("pais", pais[1]);
    const titulo = l.match(/\b(?:t[ií]tulo(?: de (?:la|mi) obra)?(?: correcto)?|mi obra se llama|la obra se llama|se titula|titulada)\s*(?:es|:)?\s*:?\s+["“«]?([^"”»\n]+?)["”»]?\s*[.!]?$/i);
    if (titulo) acepta("titulo", titulo[1]);
  });

  // 5. Una línea corta que es solo un país o una ciudad conocida.
  lineas.forEach(l => { if (l.split(/\s+/).length <= 5) acepta("pais", l); });

  // 6. "Nombre - País - Título" en una de las primeras líneas.
  lineas.slice(0, 8).forEach(l => {
    if (/@|https?:|www\./i.test(l) || l.length > 120) return;
    const partes = l.split(/\s+[-–—|]\s+/).map(p => p.trim()).filter(Boolean);
    if (partes.length < 2 || partes.length > 4) return;
    const idxPais = partes.findIndex(p => paisCanonico(p));
    if (idxPais < 0) return;
    acepta("pais", partes[idxPais]);
    const resto = partes.filter((_, i) => i !== idxPais && !/^(postulaci[oó]n|obra|env[ií]o|mundial( de collage)?|convocatoria)$/i.test(partes[i]));
    acepta("nombre", resto[0]);
    if (resto[1]) acepta("titulo", resto[1]);
  });

  // 7. Firma después de un saludo de cierre.
  lineas.forEach((l, i) => {
    if (lineas[i + 1] && /^(saludos|cordialmente|atentamente|atte|abrazos?|un abrazo|besos|muchas gracias|gracias|regards|best|cheers|obrigad[ao]|abra[çc]os|atenciosamente|cumprimentos)\b[\s,.!]*$/i.test(l)) {
      acepta("nombre", lineas[i + 1]);
    }
  });

  // 8. Título entre comillas en una línea que habla de la obra.
  lineas.forEach(l => {
    if (!/obra|t[ií]tulo|collage|llama|titul|title|called/i.test(l)) return;
    const m = l.match(/["“«‘']([^"”»’']{2,80})["”»’']/);
    if (m) acepta("titulo", m[1]);
  });

  // 9. Instagram suelto: link al perfil o "@usuario".
  const perfil = texto.match(/instagram\.com\/(?!p\/|reels?\/|stories\/|explore\/|tv\/)([A-Za-z0-9._]{2,30})/i);
  if (perfil) acepta("instagram", perfil[1]);
  (texto.match(/(?:^|[\s(])@[A-Za-z0-9._]{3,30}/g) || []).forEach(m => acepta("instagram", m.replace(/^[\s(]+/, "")));
}

const PREGUNTAS_PLANTILLA = [
  ["nombre", /tu nombre completo(\s*\(o nombre art[ií]stico\))?/i],
  ["pais", /pa[ií]s de residencia/i],
  ["titulo", /t[ií]tulo de la obra/i],
  ["instagram", /usuario de instagram(\s*\(opcional,? para etiquetarte\))?/i],
];

function campoDePlantilla(linea) {
  const pregunta = PREGUNTAS_PLANTILLA.find(p => p[1].test(linea));
  return pregunta ? pregunta[0] : null;
}

// "1. Tu nombre completo (o nombre artístico): Ana" o la respuesta en la línea
// siguiente. Una línea citada (">") nunca es respuesta: es nuestra plantilla.
function extraerRespuestasAPlantilla(crudo) {
  const res = {};
  const lineas = String(crudo || "").split(/\r?\n/);
  lineas.forEach((linea, i) => {
    const sinCita = linea.replace(/^[\s>]+/, "").replace(/\*/g, "");
    const pregunta = PREGUNTAS_PLANTILLA.find(p => p[1].test(sinCita));
    if (!pregunta || res[pregunta[0]]) return;
    // Solo lo que sigue a la pregunta: "Carlos, Argentino. Título de la obra: X"
    // o "El título de la obra es X" dejan X.
    const match = sinCita.match(pregunta[1]);
    const resto = sinCita.slice(match.index + match[0].length).replace(/^[\s:=\-–—.·•]*(?:es\s+)?[\s:=\-–—]*/i, "").trim();
    if (resto) {
      if (!/^>/.test(linea.trim())) res[pregunta[0]] = continuarValor(resto, lineas, i);
      return;
    }
    for (let j = i + 1; j < lineas.length && j <= i + 2; j++) {
      const siguiente = lineas[j];
      if (!siguiente.trim()) continue;
      if (/^\s*>/.test(siguiente) || campoDePlantilla(siguiente) || /^\s*\d\s*[.)]/.test(siguiente)) break;
      res[pregunta[0]] = siguiente.trim();
      break;
    }
  });
  return res;
}

const ETIQUETA_LINEA = /^[\s>*•·\-–—\d.)]*([^:=\n]{2,60}?)\s*[:=]\s*(.*)$/;

function clasificarEtiqueta(etiqueta) {
  const e = normalizar(etiqueta).replace(/[().,]/g, " ").replace(/\s+/g, " ").trim();
  if (e.length > 45) return null;
  if (/(^|\s)(titulo|title|titulada?)(\s|$)|nombre de (la |mi )?obra|nombre del collage|^(la |mi )?obra$/.test(e)) return "titulo";
  if (/^(tu |mi |su )?(nombre|name|artista|autor|autora|firma|seudonimo)(\s|$)/.test(e)) return "nombre";
  if (/(^|\s)(pais|country|residencia|nacionalidad|ciudad)(\s|$)/.test(e)) return "pais";
  if (/(^|\s)(instagram|ig|insta|redes|usuario)(\s|$)/.test(e)) return "instagram";
  return null;
}

function extraerEtiquetados(texto) {
  const res = {};
  const lineas = texto
    .replace(/\*/g, "")
    // "Nombre: Ana País: Chile" en una sola línea → una línea por etiqueta.
    .replace(/[ \t]+(?=(pa[ií]s|t[ií]tulo|instagram|ig|nombre de la obra)\s*:)/gi, "\n")
    .split("\n");
  lineas.forEach((linea, i) => {
    const m = linea.match(ETIQUETA_LINEA);
    if (!m) return;
    const campo = clasificarEtiqueta(m[1]);
    if (!campo) return;
    let valor = m[2].trim();
    if (!valor) valor = (lineas.slice(i + 1, i + 3).find(l => l.trim()) || "").trim();
    (res[campo] = res[campo] || []).push(continuarValor(valor, lineas, i));
  });
  return res;
}

// Un valor cortado por el fin de la línea ("Lágrimas de", "Pasado, presente
// y", una comilla sin cerrar) sigue en la línea siguiente.
function continuarValor(valor, lineas, i) {
  let v = valor;
  for (let j = i + 1; j < lineas.length && j <= i + 2 && pareceCortado(v); j++) {
    const siguiente = lineas[j].replace(/\*/g, "").trim();
    const etiqueta = siguiente.match(ETIQUETA_LINEA);
    if (!siguiente || /^>/.test(siguiente) || (etiqueta && clasificarEtiqueta(etiqueta[1])) ||
        campoDePlantilla(siguiente) || /^\d\s*[.)]/.test(siguiente)) break;
    v = `${v} ${siguiente}`;
  }
  return v;
}

function pareceCortado(valor) {
  return /\s(de|del|la|las|el|los|y|e|en|a|al|con|que|por|para|un|una|entre|sin|sobre|como|mi|su)$/i.test(valor) ||
    (String(valor).match(/["“”]/g) || []).length % 2 === 1;
}

function extraerNumerados(texto) {
  const res = {};
  texto.split("\n").forEach(linea => {
    const m = linea.trim().match(/^([1-4])\s*[.)\-]\s+(.+)/);
    if (!m || res[m[1]] || campoDePlantilla(m[2])) return;
    res[m[1]] = m[2].trim();
  });
  return res;
}

// "Pedro Pérez - Raíces" → "Raíces". Un número en el nombre del archivo
// (IMG_1234, fotos de WhatsApp, hashes) casi siempre significa que no es un
// título.
function pulirTitulo(titulo, nombre) {
  const partes = normalizar(nombre).split(/\s+/).filter(p => p.length > 2);
  if (!titulo || !partes.length) return titulo;
  const separador = /\s*[-–—|,/]\s*/g;
  let m;
  while ((m = separador.exec(titulo))) {
    const pieza = normalizar(titulo.slice(m.index + m[0].length).split(/[-–—|,/]/)[0]).split(/[^a-z0-9]+/);
    if (m.index > 0 && pieza.some(p => partes.indexOf(p) >= 0)) return titulo.slice(0, m.index).trim();
  }
  return titulo;
}

function tituloDesdeArchivo(nombreArchivo, nombreArtista) {
  const base = String(nombreArchivo || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();
  if (/\d/.test(base)) return "";
  const partesNombre = normalizar(nombreArtista).split(/\s+/).filter(p => p.length > 1);
  const nombreJunto = partesNombre.join("");
  const palabras = base.split(/\s+/).filter(p => {
    const n = normalizar(p).replace(/[^a-z0-9]/g, "");
    if (!n || n === nombreJunto || partesNombre.indexOf(n) >= 0 || paisExacto(n)) return false;
    return !/^(collage|obra|final|copia|copy|editado|edit|file|img|fb|page|foto|photo|image|imagen|scan|screenshot|captura|whatsapp)$/.test(n);
  });
  let titulo = palabras.join(" ").replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim();
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(titulo)) return "";
  if (titulo === titulo.toLowerCase() || titulo === titulo.toUpperCase()) titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
  return titulo;
}

// Corta lo citado de mensajes anteriores (incluida nuestra plantilla de
// bases, con su "1. Tu nombre completo…") y la firma. Conserva el contenido
// de un correo reenviado, que suele ser la postulación misma.
function quitarCitas(texto) {
  const lineas = String(texto || "").split(/\r?\n/);
  const salida = [];
  let enReenvio = false;
  for (let i = 0; i < lineas.length; i++) {
    const t = lineas[i].trim();
    const siguiente = (lineas[i + 1] || "").trim();
    if (/forwarded message|mensaje reenviado|begin forwarded message|mensagem encaminhada/i.test(t)) {
      enReenvio = true;
      continue;
    }
    if (enReenvio && /^(de|from|date|fecha|enviado|sent|subject|asunto|to|para|cc):/i.test(t)) continue;
    if (/^(el|on|em|le|am)\s.+(escribi[oó]|wrote|escreveu|a [ée]crit|schrieb)\s*:?\s*$/i.test(t)) break;
    if (/^(el|on|em|le|am)\s/i.test(t) && /(escribi[oó]|wrote|escreveu|a [ée]crit|schrieb)\s*:?\s*$/i.test(siguiente)) break;
    if (/^-{2,}\s*(mensaje original|original message)/i.test(t)) break;
    if (!enReenvio && /^(de|from):\s.*@/i.test(t) && /^(enviado|sent|fecha|date|para|to):/i.test(siguiente)) break;
    if (t === "--") break;
    if (/equipo del mundial internacional de collage|muchas gracias por tu inter[eé]s en sumarte/i.test(t)) break;
    if (/^>/.test(t)) continue;
    if (/^(enviado desde|sent from|obtener outlook|get outlook)/i.test(t)) continue;
    salida.push(lineas[i]);
  }
  return salida.join("\n").trim();
}

// ---------- Validación y normalización ----------

const FRASES_PLANTILLA = /tu nombre completo|nombre art[ií]stico\)|pa[ií]s de residencia|t[ií]tulo de la obra|usuario de instagram|para etiquetarte/i;

function limpiarCampo(campo, valor, desdeIA) {
  let v = String(valor == null ? "" : valor).replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (!v) return "";
  if (campo === "pais") {
    const pais = paisCanonico(v);
    if (pais) return pais;
    // Un país que el sitio no tiene en su mapa igual se anota, para verlo.
    return desdeIA && /^[A-Za-zÀ-ÿ' .\-]{3,40}$/.test(v) ? v : "";
  }
  if (campo === "instagram") return normalizarInstagram(v);
  v = v.replace(/^["“«'‘]+|["”»'’]+$/g, "").trim();
  if (campo === "titulo") {
    v = v.replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/^[\s:;,.·•\-–—_|/]+/, "") // ": Cuatrimestre", "· : Start your revolution"
      .replace(/^obra\s*[:"“]\s*/i, ""); // 'Obra "Dreamland'
    if (/^sin t[ií]tulo\W*$/i.test(v)) return "Sin título";
    // Técnica, medidas, año o país pegados al título.
    v = v.replace(/\s*\((?:collage|colagem|t[eé]cnica|digital|anal[oó]gic|mixt|\d{2,4}\s*[x×])[^)]*\)/gi, "");
    v = v.split(/\s*(?:[.,;/|]|\s[-–—])\s*(?=(?:19|20)\d{2}\b|dimensi|medidas|t[eé]cnica|formato|collage\s+(?:anal|digit|mixt)|colagem|pa[ií]s\b|nombre\b|instagram|a[nñ]o\b)/i)[0];
    v = v.split(/\s+[—–-]\s+(?=(collage|t[eé]cnica|digital|anal[oó]gic|mixt|\d))/i)[0];
    v = v.replace(/,?\s*\d{2,5}\s*[x×]\s*\d{2,5}\s*(px|cm|mm)?\.?$/i, "");
    v = v.replace(/\s*\([^)]*$/, ""); // paréntesis sin cerrar
    v = v.replace(/\s*\((19|20)\d{2}\)\s*$/, ""); // año al final
    v = v.replace(/^["“«]+|["”»]+$/g, "");
    if ((v.match(/"/g) || []).length % 2 === 1) v = v.replace(/"/g, "");
    if (/[“”]/.test(v) && !(/“/.test(v) && /”/.test(v))) v = v.replace(/[“”]/g, "");
    return v.replace(/[\s.,;:\/\\|\-–—]+$/, "").trim();
  }
  // nombre
  v = v.replace(/[,;:]+$/, "").replace(/([^\s.]{3,})\.$/, "$1").trim();
  if (v === v.toLowerCase() || v === v.toUpperCase()) v = capitalizar(v);
  return v;
}

function esAceptable(campo, valor, fila, otros) {
  return (campo === "titulo" && valor === "Sin título") || esValido(campo, valor, fila, otros);
}

function esValido(campo, valor, fila, otros) {
  const v = String(valor || "").trim();
  if (!v || esPlaceholder(campo, v) || FRASES_PLANTILLA.test(v)) return false;
  if (campo === "nombre") {
    if (v.length > 60 || v.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w)).length > 8) return false;
    if (/[:@<>]|https?:|www\.|\.com\b/i.test(v)) return false;
    if (!/\s/.test(v) && /[._\d]/.test(v)) return false; // parece un usuario o un email
    if (/^(y|e)\s|^de la obra\b/i.test(v)) return false; // "y apellido Ana"; "El Buque" sí es un nombre
    if (/mi nombre es|me llamo|les escribo|escribo desde|pesquisador|investigador|bolsista|profesor|docente|estudiante|licenciad|universidad|saludos|gracias|\bhola\b/i.test(v)) return false;
    if (paisExacto(v)) return false;
    // "Quedo atenta", "bolsista da Funadesp": palabras en minúscula que no
    // son partículas de un nombre (de, del, la…).
    if (v.split(/\s+/).some(w => /^[a-zà-ÿ]/.test(w) && w.length > 3 && PARTICULAS_NOMBRE.indexOf(w) < 0)) return false;
    return /[A-Za-zÀ-ÿ]{2,}/.test(v);
  }
  if (campo === "pais") return v.split(/\s*\/\s*/).every(p => Boolean(paisCanonico(p)));
  if (campo === "titulo") {
    if (v.length > 120 || v.split(/\s+/).length > 15) return false;
    if (/https?:|www\.|\.com\b|\/\*|@/i.test(v)) return false;
    if (/^(de la obra|del? |t[ií]tulo\b|nombre\b|obra\s*:)/i.test(v)) return false;
    // ": Cuatrimestre", "m Egar F. I", "c.- …", "España. : Idalguía"
    if (/^[:;,.·•\-–—*/]|^[b-df-hj-np-tv-xz]\s|\s:\s/.test(v) || /^[a-z][.)\-]{1,2}\s/i.test(v)) return false;
    if (/\([^)]*$/.test(v) || pareceCortado(v)) return false; // "Lágrimas de", comillas sin cerrar
    if (/\d{2,5}\s*[x×]\s*\d{2,5}\s*(px|cm|mm)?/i.test(v) || /\s[—–-]\s*(collage|t[eé]cnica|digital|anal[oó]gic)/i.test(v)) return false;
    // Nombres de archivo: hashes, "File 0000…", "Fb img".
    if (/\b[0-9a-f]{8}-[0-9a-f]{4}-|\b[0-9a-f]{12,}\b|^(file|img|fb|page|image|imagen|foto|photo|dsc|screenshot)\b/i.test(v)) return false;
    if (/mundial (internacional )?de collage/i.test(v) || esNombreDePais(v)) return false; // "México"
    if ((v.match(/[A-Za-zÀ-ÿ]/g) || []).length < 2) return false;
    const nombre = String((otros && otros.nombre) || (fila && fila[COL.nombre - 1]) || "").trim();
    const junto = texto => normalizar(texto).replace(/[^a-z0-9]/g, "");
    if (nombre && junto(v).indexOf(junto(nombre)) === 0) return false; // "NoemiFortunato"
    return true;
  }
  if (campo === "instagram") {
    if (!/^@[A-Za-z0-9._]{3,30}$/.test(v)) return false;
    const titulo = String((fila && fila[COL.titulo - 1]) || "").trim();
    return !(titulo && normalizar("@" + titulo.replace(/\s+/g, "")) === normalizar(v));
  }
  return true;
}

function esPlaceholder(campo, valor) {
  return PLACEHOLDERS[campo].indexOf(normalizar(valor)) >= 0;
}

function normalizarInstagram(valor) {
  let v = String(valor || "").trim();
  if (!v || /no tengo|no uso|ninguno|no informado|^no\.?$|^-$/i.test(v)) return "";
  const perfil = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (perfil) v = perfil[1];
  v = v.replace(/^@+/, "").split(/[\s,?/]/)[0].replace(/\.+$/, "");
  if (!/^[A-Za-z0-9._]{3,30}$/.test(v) || INSTAGRAM_PROPIOS.indexOf(v.toLowerCase()) >= 0) return "";
  return "@" + v;
}

const PARTICULAS_NOMBRE = ["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "das", "di", "van", "von", "der", "della", "dalla", "delle", "degli"];

function capitalizar(texto) {
  return texto.toLowerCase().split(/\s+/).map((palabra, i) =>
    i > 0 && PARTICULAS_NOMBRE.indexOf(palabra) >= 0 ? palabra : palabra.replace(/(^|[-'])([a-zà-ÿ])/g, (m, sep, letra) => sep + letra.toUpperCase())
  ).join(" ");
}

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function unicos(lista) {
  return lista.filter((v, i) => v && lista.indexOf(v) === i);
}

// Evita que Sheets tome un texto como fórmula ("=", "+", "-") o como número
// o fecha ("3/4", "1984").
function celdaSegura(valor) {
  if (valor === undefined || valor === null) return "";
  if (typeof valor !== "string") return valor;
  return /^[=+\-]/.test(valor) || /^[\d\s\/.:,]+$/.test(valor) ? "'" + valor : valor;
}

// ---------- Países ----------

// Los mismos nombres que usa el sitio (Intl.DisplayNames en español sobre su
// mapa), así la sincronización los reconoce sin traducir.
const NOMBRES_PAISES = "Afganistán|Albania|Alemania|Angola|Antártida|Arabia Saudí|Argelia|Argentina|Armenia|Australia|Austria|Azerbaiyán|Bahamas|Bangladés|Bélgica|Belice|Benín|Bielorrusia|Bolivia|Bosnia y Herzegovina|Botsuana|Brasil|Brunéi|Bulgaria|Burkina Faso|Burundi|Bután|Camboya|Camerún|Canadá|Catar|Chad|Chequia|Chile|China|Chipre|Colombia|Congo|Corea del Norte|Corea del Sur|Costa Rica|Côte d’Ivoire|Croacia|Cuba|Dinamarca|Ecuador|Egipto|El Salvador|Emiratos Árabes Unidos|Eritrea|Eslovaquia|Eslovenia|España|Estados Unidos|Estonia|Esuatini|Etiopía|Filipinas|Finlandia|Fiyi|Francia|Gabón|Gambia|Georgia|Ghana|Grecia|Groenlandia|Guatemala|Guinea|Guinea Ecuatorial|Guinea-Bisáu|Guyana|Haití|Honduras|Hungría|India|Indonesia|Irak|Irán|Irlanda|Islandia|Islas Malvinas|Islas Salomón|Israel|Italia|Jamaica|Japón|Jordania|Kazajistán|Kenia|Kirguistán|Kuwait|Laos|Lesoto|Letonia|Líbano|Liberia|Libia|Lituania|Luxemburgo|Macedonia del Norte|Madagascar|Malasia|Malaui|Mali|Marruecos|Mauritania|México|Moldavia|Mongolia|Montenegro|Mozambique|Myanmar (Birmania)|Namibia|Nepal|Nicaragua|Níger|Nigeria|Noruega|Nueva Caledonia|Nueva Zelanda|Omán|Países Bajos|Pakistán|Panamá|Papúa Nueva Guinea|Paraguay|Perú|Polonia|Portugal|Puerto Rico|Reino Unido|República Centroafricana|República Democrática del Congo|República Dominicana|Ruanda|Rumanía|Rusia|Sáhara Occidental|Senegal|Serbia|Sierra Leona|Siria|Somalia|Sri Lanka|Sudáfrica|Sudán|Sudán del Sur|Suecia|Suiza|Surinam|Tailandia|Taiwán|Tanzania|Tayikistán|Territorios Australes Franceses|Territorios Palestinos|Timor-Leste|Togo|Trinidad y Tobago|Túnez|Turkmenistán|Turquía|Ucrania|Uganda|Uruguay|Uzbekistán|Vanuatu|Venezuela|Vietnam|Yemen|Yibuti|Zambia|Zimbabue";

// Otros nombres, idiomas y ciudades frecuentes → país (ya normalizados).
const ALIAS_PAISES = {
  "arg": "Argentina", "caba": "Argentina", "buenos aires": "Argentina", "rosario": "Argentina", "mendoza": "Argentina", "la plata": "Argentina", "mar del plata": "Argentina", "tucuman": "Argentina", "bahia blanca": "Argentina", "neuquen": "Argentina", "salta": "Argentina",
  "mexico": "México", "cdmx": "México", "ciudad de mexico": "México", "guadalajara": "México", "monterrey": "México", "puebla": "México", "oaxaca": "México", "queretaro": "México", "tijuana": "México",
  "spain": "España", "madrid": "España", "barcelona": "España", "sevilla": "España", "bilbao": "España", "malaga": "España", "granada": "España", "zaragoza": "España", "catalunya": "España", "cataluna": "España", "pais vasco": "España", "euskadi": "España", "galicia": "España", "andalucia": "España", "canarias": "España", "mallorca": "España",
  "santiago de chile": "Chile", "valparaiso": "Chile", "vina del mar": "Chile",
  "bogota": "Colombia", "medellin": "Colombia", "cali": "Colombia", "barranquilla": "Colombia", "cartagena de indias": "Colombia",
  "lima": "Perú", "arequipa": "Perú", "cusco": "Perú", "cuzco": "Perú", "montevideo": "Uruguay", "asuncion": "Paraguay", "cochabamba": "Bolivia", "santa cruz de la sierra": "Bolivia",
  "quito": "Ecuador", "guayaquil": "Ecuador", "caracas": "Venezuela", "maracaibo": "Venezuela", "barquisimeto": "Venezuela", "la habana": "Cuba", "habana": "Cuba", "santo domingo": "República Dominicana",
  "brazil": "Brasil", "sao paulo": "Brasil", "rio de janeiro": "Brasil", "belo horizonte": "Brasil", "porto alegre": "Brasil", "curitiba": "Brasil", "brasilia": "Brasil", "florianopolis": "Brasil", "recife": "Brasil", "salvador de bahia": "Brasil",
  "lisboa": "Portugal", "lisbon": "Portugal", "porto": "Portugal",
  "italy": "Italia", "milan": "Italia", "milano": "Italia", "napoles": "Italia", "napoli": "Italia", "florencia": "Italia", "firenze": "Italia", "turin": "Italia", "torino": "Italia",
  "france": "Francia", "paris": "Francia", "marsella": "Francia", "lyon": "Francia",
  "germany": "Alemania", "deutschland": "Alemania", "berlin": "Alemania", "munich": "Alemania", "hamburgo": "Alemania",
  "uk": "Reino Unido", "united kingdom": "Reino Unido", "inglaterra": "Reino Unido", "england": "Reino Unido", "escocia": "Reino Unido", "scotland": "Reino Unido", "gales": "Reino Unido", "wales": "Reino Unido", "londres": "Reino Unido", "london": "Reino Unido",
  "usa": "Estados Unidos", "eeuu": "Estados Unidos", "ee uu": "Estados Unidos", "united states": "Estados Unidos", "estados unidos de america": "Estados Unidos", "nueva york": "Estados Unidos", "new york": "Estados Unidos", "miami": "Estados Unidos", "los angeles": "Estados Unidos", "california": "Estados Unidos", "texas": "Estados Unidos", "florida": "Estados Unidos", "chicago": "Estados Unidos",
  "toronto": "Canadá", "montreal": "Canadá", "vancouver": "Canadá",
  "holanda": "Países Bajos", "netherlands": "Países Bajos", "amsterdam": "Países Bajos", "rotterdam": "Países Bajos", "belgium": "Bélgica", "bruselas": "Bélgica", "switzerland": "Suiza", "zurich": "Suiza", "ginebra": "Suiza",
  "poland": "Polonia", "japan": "Japón", "tokio": "Japón", "tokyo": "Japón", "south korea": "Corea del Sur", "south africa": "Sudáfrica", "russia": "Rusia", "greece": "Grecia", "turkey": "Turquía", "turkiye": "Turquía",
  "sweden": "Suecia", "norway": "Noruega", "denmark": "Dinamarca", "finland": "Finlandia", "ireland": "Irlanda", "dublin": "Irlanda", "sydney": "Australia", "sidney": "Australia", "melbourne": "Australia", "new zealand": "Nueva Zelanda",
  "costa de marfil": "Côte d’Ivoire", "myanmar": "Myanmar (Birmania)", "birmania": "Myanmar (Birmania)", "republica checa": "Chequia", "czech republic": "Chequia", "emiratos arabes": "Emiratos Árabes Unidos", "arabia saudita": "Arabia Saudí", "palestina": "Territorios Palestinos", "malvinas": "Islas Malvinas", "timor oriental": "Timor-Leste",
};

// Alias cortos que solo cuentan como valor completo, nunca dentro de una frase
// ("usa" también es un verbo).
const SOLO_VALOR_COMPLETO = { "arg": true, "uk": true, "usa": true, "eeuu": true, "ee uu": true };

let INDICE_PAISES_ = null;

function indicePaises() {
  if (!INDICE_PAISES_) {
    const porClave = {};
    NOMBRES_PAISES.split("|").forEach(nombre => { porClave[claveDePais(nombre)] = nombre; });
    Object.keys(ALIAS_PAISES).forEach(alias => { porClave[alias] = ALIAS_PAISES[alias]; });
    INDICE_PAISES_ = {
      porClave,
      buscables: Object.keys(porClave)
        .filter(k => !SOLO_VALOR_COMPLETO[k])
        .map(k => ({ clave: k, re: new RegExp(`(^|[^a-z])${k}([^a-z]|$)`) })),
    };
  }
  return INDICE_PAISES_;
}

function claveDePais(texto) {
  return normalizar(texto).replace(/[’'().,;!¡]/g, " ").replace(/\s+/g, " ").trim();
}

function esNombreDePais(texto) {
  return NOMBRES_PAISES.split("|").some(nombre => claveDePais(nombre) === claveDePais(texto));
}

function paisExacto(texto) {
  return indicePaises().porClave[claveDePais(texto)] || null;
}

// Reconoce "Argentina", "Buenos Aires, Argentina", "desde Caracas"…; si el
// texto nombra dos países distintos, no elige.
function paisCanonico(texto) {
  const t = claveDePais(texto);
  if (!t) return null;
  const indice = indicePaises();
  if (indice.porClave[t]) return indice.porClave[t];
  if (t.split(" ").length > 6) return null;
  const hallados = indice.buscables.filter(b => b.re.test(t)).map(b => b.clave);
  // "republica dominicana" contiene "dominicana"; "porto alegre", "porto".
  const enteros = hallados.filter(k => !hallados.some(o => o !== k && o.indexOf(k) >= 0));
  const paises = unicos(enteros.map(k => indice.porClave[k]));
  return paises.length === 1 ? paises[0] : null;
}

// ---------- Utilidades de correo ----------

function obtenerEmailsRegistrados(hoja) {
  const emails = new Set();
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return emails;
  hoja.getRange(2, COL.email, ultimaFila - 1, 1).getValues().forEach(fila => {
    const mail = String(fila[0] || "").toLowerCase().trim();
    if (mail) emails.add(mail);
  });
  return emails;
}

function esRemitenteIgnorado(email) {
  const mail = String(email || "").toLowerCase();
  return REMITENTES_IGNORAR.some(patron => mail.indexOf(patron) >= 0);
}

function extraerEmail(texto) {
  const match = String(texto || "").match(/<([^>]+)>/);
  return (match ? match[1] : String(texto || "")).toLowerCase().trim();
}

function extraerNombre(texto) {
  const match = String(texto || "").match(/^\s*"?([^"<]+?)"?\s*</);
  const nombre = match ? match[1].replace(/["']/g, "").trim() : "";
  return nombre.indexOf("@") >= 0 ? "" : nombre;
}

// ============================================================
// TEXTOS DE RESPUESTA
// ============================================================

const CUERPO_CONFIRMACION_OBRA = `¡Hola!

Muchas gracias por sumarte a la convocatoria abierta del Mundial Internacional de Collage.

Confirmamos que tu correo ingresó correctamente a nuestro sistema. Debido al gran volumen de postulaciones de todo el mundo, estamos procesando las obras por tandas.

Si tu envío incluyó la imagen de tu collage, tu nombre, país y usuario de Instagram, ya estás en lista de revisión para el jurado. En caso de que falte algún dato o haya algún inconveniente técnico con el archivo, te escribiremos por este medio.

Seguí todas las novedades, anuncios del jurado y avances del certamen en nuestro Instagram oficial (@tehacefaltacollage_) y muy pronto en mundialdecollage.com.ar.

¡Muchos éxitos y gracias por compartir tu arte!

Equipo del Mundial Internacional de Collage`;

const CUERPO_BASES = `¡Hola!

Muchas gracias por tu interés en sumarte al Mundial Internacional de Collage. Te compartimos los lineamientos y bases para enviar tu propuesta:

• TÉCNICA: Analógico, digital o mixto.
• CANTIDAD DE OBRAS: 1 obra por artista.
• FORMATO Y MEDIDAS: Medidas y soporte libres. Para postularte solo necesitás adjuntar una fotografía clara o archivo digital de la obra (formato JPG o PNG).
• COSTO: 100% libre y gratuito. Convocatoria abierta a artistas de cualquier país.
• FECHA LÍMITE: 15 de noviembre.

DERECHOS DE AUTOR Y USO DE OBRA:
• La autoría te pertenece al 100%: Conservás la totalidad de los derechos intelectuales y patrimoniales sobre tu trabajo.
• Transparencia total: La obra se utilizará exclusivamente para la difusión cultural del certamen (sitio web y redes oficiales).

¿CÓMO ENVIAR TU POSTULACIÓN?
Respondé directamente a este correo adjuntando la imagen de tu collage e incluyendo:
1. Tu nombre completo (o nombre artístico)
2. País de residencia
3. Título de la obra
4. Usuario de Instagram (opcional, para etiquetarte)

SELECCIÓN Y RECONOCIMIENTO:
• Gran Muestra Online Oficial en mundialdecollage.com.ar.
• Edición editorial de colección: Las 30 obras finalistas formarán parte del catálogo/revista impreso oficial.

Cualquier otra duda, podés consultarnos por este medio. ¡Esperamos tu trabajo!

Equipo del Mundial Internacional de Collage
Instagram: @tehacefaltacollage_
mundialdecollage.com.ar`;
