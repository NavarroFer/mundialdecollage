import { site } from '@/lib/site'

// Términos y Condiciones: una sola fuente para la página
// /terminos-y-condiciones y para el PDF descargable
// (scripts/build-bases-pdf.mts lo arma con las bases).
// Al cambiar el texto de forma sustancial, subí TERMS_VERSION
// (lib/terms-version.ts) y TERMS_UPDATED_LABEL.
export { TERMS_PDF_URL, TERMS_VERSION } from '@/lib/terms-version'
export const TERMS_UPDATED_LABEL = '13 de octubre de 2026'

export type TermsBlock = string | { list: string[] }
export type TermsSection = { id: string; title: string; blocks: TermsBlock[] }

const E = site.email
const WEB = 'mundialdecollage.com.ar'

export const termsIntro = `Estos términos rigen el uso de ${WEB} (el «Sitio»), la participación en la convocatoria del ${site.name} (la «Convocatoria») y las compras, suscripciones e inscripciones que se hagan en el Sitio. Para enviar una obra tenés que aceptarlos marcando la casilla del formulario. Si no estás de acuerdo, no envíes obras ni hagas compras.`

export const termsSections: TermsSection[] = [
  {
    id: 'organizadores',
    title: 'Quiénes organizan',
    blocks: [
      `La Convocatoria y el Sitio están a cargo del equipo organizador del ${site.name}, integrado por Fersos y Te hace falta collage (los «Organizadores»), con base en Mar del Plata, Provincia de Buenos Aires, Argentina. Contacto: ${E}.`,
    ],
  },
  {
    id: 'internacional',
    title: 'Participación internacional',
    blocks: [
      'La Convocatoria está abierta a personas de cualquier país. Al participar desde fuera de Argentina, tené en cuenta lo siguiente:',
      {
        list: [
          'Idioma: estos términos y las bases se redactan en español, y esa es la versión que vale. Las traducciones del Sitio son una ayuda para leerlos.',
          'Horario: todas las fechas y horas (cierre de la Convocatoria, votaciones, plazos) son en hora de Argentina (UTC−3), salvo que se diga otra cosa.',
          'Edad: hay que tener 18 años o más. Las personas menores de 18 pueden participar con la autorización de su madre, padre o tutor, que acepta estos términos en su nombre. Para crear la cuenta se aplica además la edad mínima que exige Google en tu país.',
          'Ley de tu país: sos responsable de que tu participación y tus compras estén permitidas en el país donde vivís.',
          'Pagos y envíos: Mercado Pago, PayPal y los correos que usamos no operan en todos los países. Si alguno no está disponible donde vivís, puede que no podamos cobrarte o enviarte un producto.',
          'Moneda e impuestos: los precios se muestran en pesos argentinos (ARS) o en dólares (USD). Las conversiones de moneda, comisiones de tu banco o tarjeta, impuestos locales y aranceles de aduana del país de destino corren por cuenta de quien compra.',
        ],
      },
    ],
  },
  {
    id: 'convocatoria',
    title: 'Bases de la Convocatoria',
    blocks: [
      {
        list: [
          'Técnica: collage analógico, digital o mixto, con medidas y soporte libres.',
          `Obras: cada persona postula una (1) obra gratis. Con un pago único, publicado en el Sitio, puede postular hasta ${site.entries.paidLimit} obras.`,
          `Envío: desde el formulario del Sitio (con tu cuenta de Google) o por correo a ${E}, con nombre o seudónimo, país, título de la obra y, si querés, tu usuario de Instagram.`,
          `Cierre: ${site.deadlineLabel} de 2026 a las 23:59, hora de Argentina (UTC−3).`,
          `Selección: un jurado de artistas y referentes del collage elige ${site.jury.finalists} obras finalistas. Su decisión sobre la selección artística es definitiva.`,
          'Reconocimientos: las obras seleccionadas forman parte de la Gran Muestra Online Oficial, y las finalistas, de la Revista 1ª Edición de Collage (impresa).',
        ],
      },
    ],
  },
  {
    id: 'autoria',
    title: 'Autoría y material de terceros',
    blocks: [
      'Al enviar una obra declarás, con valor de declaración jurada, que:',
      {
        list: [
          'La obra es de tu autoría y tenés los derechos necesarios para presentarla.',
          'El collage trabaja con imágenes ajenas: usás recortes, fotografías o material encontrado bajo tu exclusiva responsabilidad, y la obra no infringe derechos de autor, de marca, de imagen ni de privacidad de nadie.',
          'Si en la obra aparecen personas identificables que fotografiaste vos, tenés su consentimiento para mostrarla.',
          'Si usaste imágenes generadas con inteligencia artificial, tenés derecho a usarlas. Los Organizadores pueden fijar, en cada edición, criterios sobre obras hechas con IA.',
        ],
      },
      'Si un tercero reclama por una obra, la persona que la envió responde por ese reclamo y por los daños que cause, y mantiene indemnes a los Organizadores. Mientras se resuelve, podemos retirar la obra del Sitio.',
    ],
  },
  {
    id: 'derechos',
    title: 'Tus derechos sobre la obra y nuestro permiso de uso',
    blocks: [
      'Conservás todos los derechos morales y patrimoniales sobre tu obra (Ley 11.723 de Propiedad Intelectual de Argentina). Al enviarla nos das un permiso gratuito, no exclusivo y válido en todo el mundo para:',
      {
        list: [
          'Exhibirla en el Sitio, la galería virtual y la muestra online, con tu nombre o seudónimo y tu país.',
          'Publicarla en las redes y comunicaciones del Mundial, en notas de prensa y en charlas, muestras o actividades de difusión de la Convocatoria.',
          'Incluirla en certificados de participación y, si resulta finalista, en la revista o catálogo impreso. La inclusión en publicaciones impresas se te comunica antes.',
          'Hacer adaptaciones técnicas (recortes de encuadre, cambios de tamaño o formato) para mostrarla bien en cada pantalla, sin alterar la obra en sí.',
        ],
      },
      'El permiso dura mientras esté vigente la edición y después, como archivo histórico del Mundial. No vendemos tu obra ni la usamos en productos, merchandising, kits o contenidos de suscripción sin un acuerdo aparte, por escrito, con vos.',
      `Podés pedir que retiremos tu obra del Sitio escribiendo a ${E}: la retiramos dentro de los 15 días hábiles. Lo ya impreso, o lo que terceros hayan compartido, no se puede retirar.`,
    ],
  },
  {
    id: 'curaduria',
    title: 'Curaduría y contenido no permitido',
    blocks: [
      'Los Organizadores eligen qué obras se publican, cuándo y dónde (por ejemplo, la rotación diaria de la galería). Que una obra no se publique no genera ningún derecho a reclamo. No se aceptan obras ni comentarios con contenido discriminatorio, racista, xenófobo, sexista o que inciten al odio o a la violencia, ni contenido sexual explícito o que involucre a menores. Podemos despublicar ese contenido y dar de baja la participación sin aviso previo.',
    ],
  },
  {
    id: 'cuenta',
    title: 'Tu cuenta',
    blocks: [
      'Para enviar obras o comprar podés necesitar iniciar sesión con Google. Los datos que cargás tienen que ser verdaderos, y sos responsable de lo que se haga con tu cuenta. Una cuenta corresponde a una persona.',
    ],
  },
  {
    id: 'pagos',
    title: 'Pagos, suscripciones y envíos',
    blocks: [
      'Las compras (obras adicionales, productos de la tienda, suscripciones, la revista y el taller) se pagan con Mercado Pago en Argentina y con PayPal en el resto del mundo. Precio, moneda y condiciones se muestran antes de pagar. Los pagos los procesan esos servicios: no guardamos datos de tarjetas.',
      {
        list: [
          'Arrepentimiento: si sos consumidor, podés arrepentirte de una compra dentro de los 10 días corridos desde que la hiciste o recibiste el producto, sin dar motivos (art. 34 de la Ley 24.240 de Defensa del Consumidor). Escribinos y te devolvemos el dinero por el mismo medio de pago.',
          'Suscripción mensual: se cobra cada mes hasta que la canceles, desde tu cuenta de Mercado Pago o PayPal o escribiéndonos. Al cancelar no hay más cobros ni envíos; el mes ya pagado se completa.',
          'Envíos: los plazos son estimados y dependen del correo. Revisá que la dirección sea correcta; si un paquete vuelve por un error en la dirección, el reenvío se cobra aparte. Si llega dañado o no llega, escribinos y lo resolvemos.',
          'Obras adicionales: si la Convocatoria se suspende antes del cierre, te devolvemos lo que pagaste por obras adicionales.',
        ],
      },
    ],
  },
  {
    id: 'sponsors',
    title: 'Sponsors',
    blocks: [
      'El Mundial puede tener sponsors cuyas marcas aparezcan en el Sitio, la galería virtual o las comunicaciones. Que una obra se muestre cerca de una marca no significa que su autor la respalde. Los sponsors no participan en la selección ni en el jurado, y no usamos una obra en publicidad de un sponsor sin el consentimiento de su autor. Cada sponsor es responsable de sus propias ofertas y de sus sitios.',
    ],
  },
  {
    id: 'datos',
    title: 'Datos personales',
    blocks: [
      'Tratamos tus datos según la Ley 25.326 de Protección de Datos Personales de Argentina:',
      {
        list: [
          'Qué datos: nombre o seudónimo, email (de tu cuenta de Google), país, Instagram y sitio web si los cargás, tus obras, y los datos de compra y envío.',
          'Para qué: gestionar tu participación, mostrar tus obras con su crédito, procesar compras y envíos, enviarte avisos de la Convocatoria y, si te suscribís, novedades (podés darte de baja en cualquier momento).',
          'Qué es público: nombre o seudónimo, país, Instagram, sitio web y obras publicadas. Tu email y tu dirección no se publican.',
          'Con quién: con los servicios que usamos para operar el Sitio (alojamiento, base de datos, correo, analítica, pagos y envíos). Algunos guardan los datos fuera de Argentina. No vendemos tus datos.',
          `Tus derechos: podés pedir acceso, corrección o borrado de tus datos escribiendo a ${E}. Si vivís en la Unión Europea o el Reino Unido, también podés ejercer los derechos que te da tu normativa local.`,
        ],
      },
      'La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende denuncias y reclamos de quienes vean afectados sus derechos sobre sus datos personales.',
    ],
  },
  {
    id: 'eventos',
    title: 'Fotos y videos de actividades',
    blocks: [
      'En muestras, charlas, talleres y otras actividades del Mundial podemos sacar fotos y grabar videos, y usarlos para difundir el proyecto. Si no querés aparecer, avisanos en el lugar o después por correo.',
    ],
  },
  {
    id: 'responsabilidad',
    title: 'Disponibilidad y responsabilidad',
    blocks: [
      'Hacemos lo posible para que el Sitio funcione bien, pero puede tener errores o interrupciones. Guardá siempre tus archivos originales: el Sitio no es un servicio de respaldo. No respondemos por fallas de servicios de terceros (Google, Mercado Pago, PayPal, correos) ni por errores en lo que publican otras personas. Nada de esto limita los derechos que la ley te da como consumidor.',
    ],
  },
  {
    id: 'suspension',
    title: 'Suspensión o cambios de la Convocatoria',
    blocks: [
      'Por razones de fuerza mayor o ajenas a nuestro control, podemos modificar fechas, suspender o dar por terminada la Convocatoria, y lo vamos a avisar en el Sitio. Si eso pasa, se aplica lo dicho sobre devoluciones de obras adicionales.',
    ],
  },
  {
    id: 'cambios',
    title: 'Cambios a estos términos',
    blocks: [
      'Podemos actualizar estos términos. Cada versión lleva su fecha. Si un cambio afecta tus derechos sobre obras que ya enviaste, te vamos a pedir que lo aceptes de nuevo; si no lo aceptás, siguen valiendo para esas obras los términos que aceptaste.',
    ],
  },
  {
    id: 'ley',
    title: 'Ley aplicable y jurisdicción',
    blocks: [
      `Estos términos se rigen por las leyes de la República Argentina. Ante cualquier conflicto, primero escribinos a ${E} para buscar una solución. Si no la hay, intervienen los tribunales ordinarios de Mar del Plata, Provincia de Buenos Aires, salvo que la ley de defensa del consumidor te permita reclamar ante los de tu domicilio. Si vivís en otro país, conservás los derechos de consumidor que tu ley local no permite renunciar.`,
    ],
  },
]
