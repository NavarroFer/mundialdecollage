import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// scripts/apps-script/Registro.gs runs inside Google Apps Script. These tests
// load it into a Node sandbox with in-memory stand-ins for Gmail, Drive and
// the sheet, using the real failure cases seen in the Registro tab.
const codigo = readFileSync(new URL('./apps-script/Registro.gs', import.meta.url), 'utf8')

type Script = any

function cargar(globales: Record<string, unknown> = {}): Script {
  const contexto = vm.createContext({
    Logger: { log() {} },
    Utilities: { formatDate: () => '23/09/2026 10:00', sleep() {} },
    DriveApp: { Access: { ANYONE_WITH_LINK: 'anyone' }, Permission: { VIEW: 'view' } },
    ...globales,
  })
  vm.runInContext(codigo, contexto)
  return contexto
}

const plano = <T,>(valor: T): T => JSON.parse(JSON.stringify(valor))

type Adjunto = { nombre: string; tipo?: string; bytes?: number }

function mensaje(de: string, cuerpo: string, fecha: string, adjuntos: Adjunto[] = []) {
  const respuestas: string[] = []
  return {
    respuestas,
    getFrom: () => de,
    getPlainBody: () => cuerpo,
    getDate: () => new Date(fecha),
    getAttachments: () => adjuntos.map((a) => ({
      getName: () => a.nombre,
      getContentType: () => a.tipo ?? 'image/jpeg',
      getSize: () => a.bytes ?? 500_000,
    })),
    reply: (texto: string) => { respuestas.push(texto) },
  }
}
type Mensaje = ReturnType<typeof mensaje>

function hilo(id: string, asunto: string, mensajes: Mensaje[]) {
  return {
    mensajes,
    getId: () => id,
    getFirstMessageSubject: () => asunto,
    getMessages: () => mensajes,
    getLastMessageDate: () => mensajes[mensajes.length - 1].getDate(),
  }
}
type Hilo = ReturnType<typeof hilo>

function gmail(hilos: Hilo[]) {
  return {
    getThreadById: (id: string) => hilos.find((h) => h.getId() === id) ?? null,
    search: (consulta: string) => {
      const de = consulta.match(/^from:\((.+?)\)/)?.[1]
      if (de) return hilos.filter((h) => h.getMessages().some((m) => m.getFrom().includes(de)))
      const menciona = consulta.match(/^"(.+?)"/)?.[1]
      if (menciona) return hilos.filter((h) => h.getMessages().some((m) => m.getPlainBody().includes(menciona)))
      return []
    },
  }
}

// Mimics what Sheets displays: a leading apostrophe forces text and is hidden.
class Hoja {
  filas: string[][]
  constructor(filas: string[][]) {
    this.filas = filas.map((f) => Array.from({ length: 10 }, (_, i) => f[i] ?? ''))
  }
  mostrar(valor: unknown) {
    const texto = String(valor ?? '')
    return texto.startsWith("'") ? texto.slice(1) : texto
  }
  getLastRow() { return this.filas.length }
  getMaxColumns() { return 10 }
  appendRow(fila: unknown[]) { this.filas.push(Array.from({ length: 10 }, (_, i) => this.mostrar(fila[i]))) }
  getRange(fila: number, col: number, filas = 1, cols = 1) {
    const valores = () => this.filas.slice(fila - 1, fila - 1 + filas).map((f) => f.slice(col - 1, col - 1 + cols))
    return {
      getDisplayValues: valores,
      getValues: valores,
      setValue: (valor: unknown) => { this.filas[fila - 1][col - 1] = this.mostrar(valor) },
    }
  }
}

function propiedades(inicial: Record<string, string> = {}) {
  const datos: Record<string, string> = { ...inicial }
  return {
    datos,
    getProperty: (k: string) => datos[k] ?? null,
    setProperty: (k: string, v: string) => { datos[k] = v },
    deleteProperty: (k: string) => { delete datos[k] },
  }
}

const ENCABEZADO = ['Nombre', 'País', 'Email', 'Obra (Foto en Drive)', 'Titulo', 'Instagram', 'Correo', 'Fecha', 'Revisar', 'Datos del script (no editar)']
const PLANTILLA_CITADA = `El mar, 16 sept 2026 a las 10:00, Mundial de Collage <mundialdecollage@gmail.com> escribió:
> ¿CÓMO ENVIAR TU POSTULACIÓN?
> 1. Tu nombre completo (o nombre artístico)
> 2. País de residencia
> 3. Título de la obra
> 4. Usuario de Instagram (opcional, para etiquetarte)`

function entrada(textos: string[], extra: { remitente?: string; asunto?: string; adjuntos?: string[] } = {}) {
  const s = cargar()
  const mensajes = textos.map((t, i) => mensaje(extra.remitente ?? 'artista@example.com', t, `2026-09-2${i}T10:00:00Z`))
  return { s, entrada: s.armarEntrada(extra.remitente ?? 'artista@example.com', extra.asunto ?? '', mensajes, extra.adjuntos ?? []) }
}

function reglas(textos: string[], extra: Parameters<typeof entrada>[1] = {}) {
  const { s, entrada: e } = entrada(textos, extra)
  return plano(s.extraerConReglas(e))
}

describe('Registro.gs: extracción por reglas', () => {
  it('no confunde "Nombre de la obra" ni "Nombre y apellido" con otra cosa', () => {
    const datos = reglas(['Hola!\nNombre y apellido: Roxana Bidoglio (Robi)\nPaís: Argentina\nNombre de la obra: Edificios azules'])
    assert.equal(datos.nombre, 'Roxana Bidoglio (Robi)')
    assert.equal(datos.pais, 'Argentina')
    assert.equal(datos.titulo, 'Edificios azules')
  })

  it('toma el título entre comillas, el país suelto y el nombre de la firma', () => {
    const datos = reglas(['Hola! Les comparto mi obra.\nNombre de la obra: "Metamorfosis"\nArgentina\n\nSaludos,\nEliana Ramponi'], { remitente: 'eli <elianaramponi@gmail.com>' })
    assert.equal(datos.titulo, 'Metamorfosis')
    assert.equal(datos.pais, 'Argentina')
    assert.equal(datos.nombre, 'Eliana Ramponi')
  })

  it('lee respuestas escritas dentro de la plantilla citada', () => {
    const cuerpo = `Hola, les envío mi postulación.

El mar, 16 sept 2026 a las 10:00, Mundial de Collage <mundialdecollage@gmail.com> escribió:
> ¿CÓMO ENVIAR TU POSTULACIÓN?
> 1. Tu nombre completo (o nombre artístico)
Miguel Ángel Navarrete Romero
> 2. País de residencia
México
> 3. Título de la obra
Sueño de papel
> 4. Usuario de Instagram (opcional, para etiquetarte)
@miguelnav`
    assert.deepEqual(reglas([cuerpo], { adjuntos: ['Escáner_20260916.jpg'] }), {
      nombre: 'Miguel Ángel Navarrete Romero', pais: 'México', titulo: 'Sueño de papel', instagram: '@miguelnav', imagen_principal: 0, dudas: '',
    })
  })

  it('lee la plantilla copiada con respuestas después de los dos puntos', () => {
    const datos = reglas(['1. Tu nombre completo (o nombre artístico): Ana Pérez\n2. País de residencia: Uruguay\n3. Título de la obra: Mar\n4. Usuario de Instagram (opcional, para etiquetarte): https://www.instagram.com/ana.collage?igsh=abc'])
    assert.equal(datos.nombre, 'Ana Pérez')
    assert.equal(datos.pais, 'Uruguay')
    assert.equal(datos.titulo, 'Mar')
    assert.equal(datos.instagram, '@ana.collage')
  })

  it('nunca usa el texto de nuestra plantilla como dato', () => {
    const datos = reglas([`Hola! Adjunto mi obra "Big Bang Collage".\nSaludos,\nAlejandra Yermany\nChile\n\n${PLANTILLA_CITADA}`])
    assert.equal(datos.titulo, 'Big Bang Collage')
    assert.equal(datos.nombre, 'Alejandra Yermany')
    assert.equal(datos.pais, 'Chile')
    assert.equal(datos.instagram, '')
  })

  it('entiende "Nombre - País - Título" y portugués', () => {
    const dash = reglas(["Paola Griffero - Argentina - 'Valkiria'"])
    assert.equal(dash.nombre, 'Paola Griffero')
    assert.equal(dash.pais, 'Argentina')
    assert.equal(dash.titulo, 'Valkiria')

    const pt = reglas(['Olá! Meu nome é Ana Bowie, moro em São Paulo, Brasil.\nEnvio minha obra "Mamma".'])
    assert.equal(pt.nombre, 'Ana Bowie')
    assert.equal(pt.pais, 'Brasil')
    assert.equal(pt.titulo, 'Mamma')
  })

  it('una corrección en un mensaje posterior gana', () => {
    const datos = reglas(['Título: Sueños', 'Perdón, el título correcto es: Sueños rotos'])
    assert.equal(datos.titulo, 'Sueños rotos')
  })

  it('descarta firmas institucionales y usa la firma personal', () => {
    const datos = reglas(['Segue minha obra.\nAbraços,\nCarlos Zulietti'], { remitente: 'Pesquisador bolsista da Funadesp <zulietti.zulietti@gmail.com>' })
    assert.equal(datos.nombre, 'Carlos Zulietti')
  })

  it('usa el nombre del archivo como último recurso y lo marca', () => {
    const datos = reglas(['Hola, les mando mi collage.'], { remitente: 'Andrea Trotta <andrea@example.com>', adjuntos: ['Andrea Trotta - Contaminacion.png'] })
    assert.equal(datos.titulo, 'Contaminacion')
    assert.equal(datos.dudas, 'Título tomado del nombre del archivo')
    assert.equal(reglas(['Hola'], { adjuntos: ['IMG_3044.jpeg'] }).titulo, '')
  })

  it('usa el asunto cuando el cuerpo no trae el dato', () => {
    const datos = reglas(['Adjunto mi obra.'], { asunto: 'Postulación - Lucía Gómez - Argentina - Raíces' })
    assert.equal(datos.nombre, 'Lucía Gómez')
    assert.equal(datos.pais, 'Argentina')
    assert.equal(datos.titulo, 'Raíces')
  })
})

describe('Registro.gs: validación', () => {
  const s = cargar()

  it('rechaza los valores mal extraídos que hay hoy en Registro', () => {
    for (const nombre of ['de la obra: "Metamorfosis"', 'São Paulo', 'y apellido: Roxana Bidoglio (Robi)', 'Pesquisador bolsista da Funadesp', 'Tu nombre completo (o nombre artístico)', 'angelica.machuca.c']) {
      assert.equal(s.esValido('nombre', nombre), false, nombre)
    }
    assert.equal(s.esValido('nombre', 'Quedo atenta'), false)
    for (const nombre of ['Pao G.', 'Among Scratches', 'Miguel Ángel Navarrete Romero', 'Roxana Bidoglio (Robi)', 'María de los Ángeles Pérez', 'Francisco Javier Gallardo Vega (cuauhtemoc.caloch)']) {
      assert.equal(s.esValido('nombre', nombre), true, nombre)
    }
    const fila = (nombre: string, titulo = '') => [nombre, '', '', '', titulo]
    for (const titulo of ['de la obra', 'pjp2cl.mystrikingly.com/*', 'La presencia, la ausencia y lo que hay en medio. (2026) (El orden', 'Morfologías íntimas 02 — collage digital, 1535 × 2048 px', 'Sin título']) {
      assert.equal(s.esValido('titulo', titulo, fila('Leylani')), false, titulo)
    }
    assert.equal(s.esValido('titulo', 'Angélica Machuca Carreño.', fila('Angélica Machuca')), false)
    assert.equal(s.esValido('titulo', 'Valkiria', fila('Pao G.')), true)
    assert.equal(s.esAceptable('titulo', 'Sin título', fila('Pao G.')), true)
    for (const ig of ['Souvenir', '@de', 'No informado', 'El arte del kintsugi']) {
      assert.equal(s.esValido('instagram', ig, fila('Chris', 'Souvenir')), false, ig)
    }
    assert.equal(s.esValido('instagram', '@jessicardonne', fila('Jessica', 'Playlist')), true)
  })

  it('limpia títulos con técnica, medidas y paréntesis sin cerrar', () => {
    assert.equal(s.limpiarCampo('titulo', 'Morfologías íntimas 02 — collage digital, 1535 × 2048 px'), 'Morfologías íntimas 02')
    assert.equal(s.limpiarCampo('titulo', 'La presencia, la ausencia y lo que hay en medio. (2026) (El orden'), 'La presencia, la ausencia y lo que hay en medio')
    assert.equal(s.limpiarCampo('titulo', '“Metamorfosis”'), 'Metamorfosis')
    assert.equal(s.limpiarCampo('titulo', 'sin titulo'), 'Sin título')
    assert.equal(s.limpiarCampo('nombre', 'MARÍA DE LOS ÁNGELES PÉREZ'), 'María de los Ángeles Pérez')
    assert.equal(s.limpiarCampo('instagram', 'https://www.instagram.com/hiloypapel_marina?igsh=xyz'), '@hiloypapel_marina')
    assert.equal(s.limpiarCampo('instagram', '@tehacefaltacollage_'), '')
  })

  it('reconoce países y ciudades con los nombres que usa el sitio', () => {
    assert.equal(s.paisCanonico('Buenos Aires, Argentina'), 'Argentina')
    assert.equal(s.paisCanonico('República Dominicana'), 'República Dominicana')
    assert.equal(s.paisCanonico('Granada'), 'España')
    assert.equal(s.paisCanonico('USA'), 'Estados Unidos')
    assert.equal(s.paisCanonico('la usa para sus collages'), null)
    assert.equal(s.paisCanonico('São Paulo'), 'Brasil')
    assert.equal(s.paisCanonico('Porto Alegre'), 'Brasil')
    assert.equal(s.paisCanonico('Lima, Perú'), 'Perú')
    assert.equal(s.paisCanonico('Chile y Argentina'), null)
    assert.equal(s.paisCanonico('Sin especificar'), null)
    assert.equal(s.esValido('pais', 'Canadá / Venezuela'), true)
  })

  it('protege celdas que Sheets interpretaría como fórmula, número o fecha', () => {
    assert.equal(s.celdaSegura('=HYPERLINK("x")'), '\'=HYPERLINK("x")')
    assert.equal(s.celdaSegura('1984'), "'1984")
    assert.equal(s.celdaSegura('3/4'), "'3/4")
    assert.equal(s.celdaSegura('@usuario'), '@usuario')
  })

  it('corta citas en castellano, inglés y Outlook pero conserva un reenvío', () => {
    assert.equal(s.quitarCitas(`Va mi obra.\n\n${PLANTILLA_CITADA}`), 'Va mi obra.')
    assert.equal(s.quitarCitas('Hola\nOn Tue, Sep 23, 2026 at 10:00 AM Mundial <mundialdecollage@gmail.com> wrote:\n> texto'), 'Hola')
    assert.equal(s.quitarCitas('Hola\nEl mar, 23 sept 2026 a las 10:00, Mundial de Collage <\nmundialdecollage@gmail.com> escribió:\n> x'), 'Hola')
    assert.equal(s.quitarCitas('Hola\nDe: Mundial <mundialdecollage@gmail.com>\nEnviado: martes\nbases'), 'Hola')
    assert.match(s.quitarCitas('---------- Forwarded message ---------\nDe: Ana <ana@x.com>\nDate: lun\nNombre: Ana Pérez'), /Nombre: Ana Pérez/)
  })
})

describe('Registro.gs: reparación idempotente de filas', () => {
  function escenario() {
    const hilos = [
      hilo('h1', 'Postulación', [mensaje('eli <elianaramponi@gmail.com>', `Hola!\nNombre y apellido: Eliana Ramponi\nNombre de la obra: "Metamorfosis"\nPaís: Argentina\nInstagram: @eli.ramponi\n\n${PLANTILLA_CITADA}`, '2026-09-23T13:00:00Z', [{ nombre: 'metamorfosis.jpg' }])]),
      hilo('h2', 'Mi obra', [mensaje('Paola <paogriff@hotmail.com>', "Paola Griffero - Argentina - 'Valkiria'", '2026-09-07T12:00:00Z', [{ nombre: 'IMG_1.jpg' }])]),
      hilo('h3', 'Obra', [mensaje('<mammabowie@gmail.com>', 'Olá! Meu nome é Ana Bowie, moro em São Paulo, Brasil.\nEnvio minha obra "Mamma".', '2026-09-23T14:00:00Z', [{ nombre: 'a.jpg' }, { nombre: 'b.jpg' }])]),
      hilo('h4', 'Souvenir', [mensaje('Chris <chris@example.com>', 'Obra: Souvenir\nIG: @chris.citta', '2026-09-23T09:40:00Z', [{ nombre: 'IMG_2.jpg' }])]),
    ]
    const hoja = new Hoja([
      ENCABEZADO,
      ['de la obra: "Metamorfosis"', 'Argentina', 'elianaramponi@gmail.com', 'https://drive.google.com/file/d/AAA/view?usp=drivesdk', 'Metamorfosis', 'No informado', 'https://mail.google.com/mail/u/0/#inbox/h1', '23/09/2026 13:02'],
      ['Paola Griffero', 'Argentina', 'paogriff@hotmail.com', 'Paola - IMG_1.jpg', '', '', '', ''],
      ['São Paulo', 'Brasil', 'mammabowie@gmail.com', 'https://drive.google.com/file/d/X1/view?usp=drivesdk , https://drive.google.com/file/d/X2/view?usp=drivesdk', 'Sin título', 'No informado', 'https://mail.google.com/mail/u/0/#inbox/h3', '23/09/2026 14:00'],
      ['Chris Cittadino', 'Argentina', 'chris@example.com', 'https://drive.google.com/file/d/CCC/view', 'Souvenir', 'Souvenir', 'https://mail.google.com/mail/u/0/#inbox/h4', '23/09/2026 09:42'],
      ['Moni Losada', 'argentina', 'moni@example.com', 'Moni_Losada_collage_1', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ])
    const s = cargar({ GmailApp: gmail(hilos) })
    const props = propiedades()
    const ctx = { hojaRegistro: hoja, props, claveClaude: null }
    return { s, hoja, ctx, props, hilos }
  }
  const celda = (hoja: Hoja, fila: number, col: number) => hoja.filas[fila - 1][col - 1]

  it('completa y corrige lo que falta o está mal, sin tocar lo cargado a mano', () => {
    const { s, hoja, ctx } = escenario()
    s.repararRegistro_(ctx, Date.now())

    // Fila del script vieja: nombre mal extraído, Instagram provisorio.
    assert.equal(celda(hoja, 2, 1), 'Eliana Ramponi')
    assert.equal(celda(hoja, 2, 5), 'Metamorfosis')
    assert.equal(celda(hoja, 2, 6), '@eli.ramponi')
    // Fila curada a mano: nombre y país intactos, título completado.
    assert.equal(celda(hoja, 3, 1), 'Paola Griffero')
    assert.equal(celda(hoja, 3, 5), 'Valkiria')
    assert.equal(celda(hoja, 3, 7), 'https://mail.google.com/mail/u/0/#all/h2')
    // Varios links: queda el primero (el que ya usa el sitio) y el resto se anota.
    assert.equal(celda(hoja, 4, 1), 'Ana Bowie')
    assert.equal(celda(hoja, 4, 4), 'https://drive.google.com/file/d/X1/view?usp=drivesdk')
    assert.equal(celda(hoja, 4, 5), 'Mamma')
    assert.match(celda(hoja, 4, 9), /Otras imágenes: https:\/\/drive\.google\.com\/file\/d\/X2/)
    // Título en la columna de Instagram.
    assert.equal(celda(hoja, 5, 5), 'Souvenir')
    assert.equal(celda(hoja, 5, 6), '@chris.citta')
    // Sin correo: se avisa y no se inventa nada; el país sí se normaliza.
    assert.equal(celda(hoja, 6, 2), 'Argentina')
    assert.equal(celda(hoja, 6, 5), '')
    assert.match(celda(hoja, 6, 9), /No encontré el correo original/)
    // Filas vacías no se tocan.
    assert.deepEqual(hoja.filas[6], Array(10).fill(''))
  })

  it('una segunda corrida no cambia nada', () => {
    const { s, hoja, ctx } = escenario()
    s.repararRegistro_(ctx, Date.now())
    const antes = plano(hoja.filas)
    s.repararRegistro_(ctx, Date.now())
    assert.deepEqual(hoja.filas, antes)
  })

  it('respeta lo editado a mano y vuelve a extraer lo que se vacía', () => {
    const { s, hoja, ctx, props } = escenario()
    s.repararRegistro_(ctx, Date.now())

    hoja.filas[1][0] = 'Eli Ramponi' // corrección a mano de un valor del script
    hoja.filas[1][5] = '' // vaciar un valor del script lo vuelve a extraer…
    hoja.filas[4][4] = '' // …y también uno que había cargado una persona
    s.repararRegistro_(ctx, Date.now())
    assert.equal(celda(hoja, 2, 1), 'Eli Ramponi')
    assert.equal(celda(hoja, 2, 6), '@eli.ramponi')
    assert.match(celda(hoja, 2, 9), /Sugerencia nombre: Eliana Ramponi/)
    assert.equal(celda(hoja, 5, 5), 'Souvenir')

    // Una ronda completa nueva (reiniciarReparacion) tampoco pisa la corrección.
    props.setProperty('reparar:ronda', '1')
    s.repararRegistro_(ctx, Date.now())
    assert.equal(celda(hoja, 2, 1), 'Eli Ramponi')
  })
})

describe('Registro.gs: simulación', () => {
  it('propone los mismos cambios sin escribir en la hoja', () => {
    const hilos = [hilo('h1', 'Obra', [mensaje('Paola <paogriff@hotmail.com>', "Paola Griffero - Argentina - 'Valkiria'", '2026-09-07T12:00:00Z', [{ nombre: 'IMG_1.jpg' }])])]
    const hoja = new Hoja([ENCABEZADO, ['Paola Griffero', 'argentina', 'paogriff@hotmail.com', 'IMG_1.jpg', '', '', '', '']])
    const antes = plano(hoja.filas)
    const s = cargar({ GmailApp: gmail(hilos) })
    const cambios: string[][] = []
    s.repararRegistro_({ hojaRegistro: s.hojaSimulada(hoja, cambios), props: propiedades(), claveClaude: null }, Date.now())
    assert.deepEqual(hoja.filas, antes)
    assert.deepEqual(plano(cambios).filter((c) => c[1] !== 'Revisar' && c[1] !== 'Correo'), [
      [2, 'País', 'argentina', 'Argentina'],
      [2, 'Título', '', 'Valkiria'],
    ])
  })
})

describe('Registro.gs: correos nuevos', () => {
  it('no reprocesa hilos de la versión anterior a los que no respondimos', () => {
    const viejo = mensaje('Ana <ana@example.com>', 'Mi obra', '2026-09-22T10:00:00Z', [{ nombre: 'obra.jpg' }])
    const h = hilo('v1', 'Obra', [viejo])
    const s = cargar({ GmailApp: gmail([h]) })
    const ctx = { hojaRegistro: new Hoja([ENCABEZADO]), hojaConsultas: new Hoja([['Nombre']]), props: propiedades(), claveClaude: null, emailsRegistrados: new Set<string>(['ana@example.com']) }
    s.procesarHilo(ctx, h, true)
    assert.equal(ctx.hojaConsultas.filas.length, 1)
    assert.equal(ctx.props.datos['hilo:v1'], String(viejo.getDate().getTime()))
  })


  it('registra la obra una sola vez y relee la fila cuando llega una corrección', () => {
    const creados: string[] = []
    const carpeta = {
      createFile: () => {
        const id = `F${creados.length + 1}`
        creados.push(id)
        return { getId: () => id, setName() {}, setSharing() {} }
      },
    }
    const primero = mensaje('Lucía Gómez <lucia@example.com>', `Hola!
1. Tu nombre completo (o nombre artístico): Lucía Gómez
2. País de residencia: Argentina
3. Título de la obra: Raíces
4. Usuario de Instagram (opcional, para etiquetarte): @lu.gomez

${PLANTILLA_CITADA}`, '2026-09-23T10:00:00Z', [{ nombre: 'raices.jpg' }, { nombre: 'detalle.jpg' }, { nombre: 'firma.png', bytes: 2_000 }])
    const h = hilo('n1', 'Re: Mundial de Collage', [primero])
    const hoja = new Hoja([ENCABEZADO])
    const consultas = new Hoja([['Nombre', 'Mensaje / Consulta', 'Email', 'Estado', '', '']])
    const s = cargar({ GmailApp: gmail([h]) })
    const ctx = { hojaRegistro: hoja, hojaConsultas: consultas, carpeta, props: propiedades(), claveClaude: null, emailsRegistrados: new Set<string>() }

    s.procesarHilo(ctx, h)
    assert.equal(hoja.filas.length, 2)
    assert.deepEqual(hoja.filas[1].slice(0, 8), [
      'Lucía Gómez', 'Argentina', 'lucia@example.com', 'https://drive.google.com/file/d/F1/view',
      'Raíces', '@lu.gomez', 'https://mail.google.com/mail/u/0/#all/n1', '23/09/2026 10:00',
    ])
    assert.equal(hoja.filas[1][8], 'Otras imágenes: https://drive.google.com/file/d/F2/view')
    assert.deepEqual(creados, ['F1', 'F2']) // el logo de la firma no se guarda
    assert.equal(primero.respuestas.length, 1)

    // Volver a correr no duplica la fila ni la respuesta.
    s.procesarHilo(ctx, h)
    assert.equal(hoja.filas.length, 2)
    assert.equal(primero.respuestas.length, 1)

    // El artista corrige el título en el mismo hilo.
    h.mensajes.push(mensaje('Lucía Gómez <lucia@example.com>', 'Perdón, el título correcto es: Raíces de papel', '2026-09-23T12:00:00Z'))
    s.procesarHilo(ctx, h)
    assert.equal(hoja.filas.length, 2)
    assert.equal(consultas.filas[1][3], 'Responder a mano')
    s.repararRegistro_(ctx, Date.now())
    assert.equal(hoja.filas[1][4], 'Raíces de papel')
    assert.equal(hoja.filas[1][0], 'Lucía Gómez')
  })

  it('responde las bases a una consulta nueva y no las repite en el mismo hilo', () => {
    const consulta = mensaje('Pedro <pedro@example.com>', '¿Cómo participo?', '2026-09-23T10:00:00Z')
    const h = hilo('c1', 'Consulta', [consulta])
    const consultas = new Hoja([['Nombre', 'Mensaje / Consulta', 'Email', 'Estado', '', '']])
    const s = cargar({ GmailApp: gmail([h]) })
    const ctx = { hojaRegistro: new Hoja([ENCABEZADO]), hojaConsultas: consultas, props: propiedades(), claveClaude: null, emailsRegistrados: new Set<string>() }

    s.procesarHilo(ctx, h)
    assert.equal(consulta.respuestas.length, 1)
    assert.equal(consultas.filas[1][3], 'Bases enviadas')

    h.mensajes.push(mensaje('Mundial de Collage <mundialdecollage@gmail.com>', 'bases', '2026-09-23T10:01:00Z'))
    const repregunta = mensaje('Pedro <pedro@example.com>', '¿Puedo mandar dos obras?', '2026-09-23T11:00:00Z')
    h.mensajes.push(repregunta)
    s.procesarHilo(ctx, h)
    assert.equal(repregunta.respuestas.length, 0)
    assert.equal(consultas.filas[2][3], 'Responder a mano')

    h.mensajes.push(mensaje('Pedro <pedro@example.com>', '¡Muchas gracias!', '2026-09-23T12:00:00Z'))
    s.procesarHilo(ctx, h)
    assert.equal(consultas.filas.length, 3)
  })
})

describe('Registro.gs: extracción con Claude', () => {
  it('manda un pedido estructurado y valida la respuesta campo por campo', () => {
    const pedidos: any[] = []
    const UrlFetchApp = {
      fetch: (url: string, opciones: any) => {
        pedidos.push({ url, headers: opciones.headers, cuerpo: JSON.parse(opciones.payload) })
        const datos = { nombre: 'Tu nombre completo', pais: 'Singapur', titulo: '', instagram: 'lu.gomez', imagen_principal: 1, dudas: 'Declara dos países' }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(datos) }] }),
        }
      },
    }
    const s = cargar({ UrlFetchApp })
    const e = s.armarEntrada('Lucía Gómez <lucia@example.com>', 'Obra', [mensaje('Lucía Gómez <lucia@example.com>', 'Hola, va mi obra', '2026-09-23T10:00:00Z')], ['Lucia Gomez - Raices.jpg'])
    const datos = plano(s.extraerDatos({ claveClaude: 'clave' }, e))
    assert.equal(datos.nombre, 'Lucía Gómez') // lo de Claude no pasa la validación: quedan las reglas
    assert.equal(datos.pais, 'Singapur') // fuera del mapa del sitio, pero se anota
    assert.equal(datos.titulo, '') // Claude no lo encontró: no se adivina del archivo
    assert.equal(datos.instagram, '@lu.gomez')
    assert.equal(datos.imagen_principal, 1)
    assert.equal(datos.dudas, 'Declara dos países')

    const [pedido] = pedidos
    assert.equal(pedido.url, 'https://api.anthropic.com/v1/messages')
    assert.equal(pedido.headers['x-api-key'], 'clave')
    assert.equal(pedido.headers['anthropic-version'], '2023-06-01')
    assert.equal(pedido.headers['anthropic-beta'], 'server-side-fallback-2026-07-01')
    assert.equal(pedido.cuerpo.model, 'claude-opus-5')
    assert.equal(pedido.cuerpo.fallbacks, 'default')
    assert.equal(pedido.cuerpo.output_config.format.type, 'json_schema')
    assert.match(pedido.cuerpo.messages[0].content, /\[0\] Lucia Gomez - Raices\.jpg/)
  })

  it('si la cuenta no admite el respaldo, repite el pedido sin él', () => {
    const pedidos: any[] = []
    const UrlFetchApp = {
      fetch: (_url: string, opciones: any) => {
        const cuerpo = JSON.parse(opciones.payload)
        pedidos.push({ headers: opciones.headers, cuerpo })
        if (cuerpo.fallbacks) return { getResponseCode: () => 400, getContentText: () => 'unsupported' }
        const datos = { nombre: 'Ana Pérez', pais: 'Argentina', titulo: 'Mar', instagram: '', imagen_principal: 0, dudas: '' }
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(datos) }] }) }
      },
    }
    const s = cargar({ UrlFetchApp })
    const e = s.armarEntrada('Ana <ana@example.com>', '', [mensaje('Ana <ana@example.com>', 'Hola', '2026-09-23T10:00:00Z')], [])
    assert.equal(plano(s.extraerDatos({ claveClaude: 'clave' }, e)).titulo, 'Mar')
    assert.equal(pedidos.length, 2)
    assert.equal(pedidos[1].headers['anthropic-beta'], undefined)
    assert.equal(pedidos[1].cuerpo.fallbacks, undefined)
  })

  it('si Claude falla, quedan las reglas', () => {
    const s = cargar({ UrlFetchApp: { fetch: () => ({ getResponseCode: () => 529, getContentText: () => 'overloaded' }) } })
    const e = s.armarEntrada('Ana <ana@example.com>', '', [mensaje('Ana <ana@example.com>', 'Título: Mar', '2026-09-23T10:00:00Z')], [])
    assert.equal(plano(s.extraerDatos({ claveClaude: 'clave' }, e)).titulo, 'Mar')
  })
})
