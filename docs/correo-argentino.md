# Retiro en sucursal — suscripciones en Argentina

La tienda publica el precio del plan + envío. El checkout permite elegir una
sucursal, cotiza PAQ.AR Clásico a sucursal y muestra el total mensual antes de
crear una suscripción de Mercado Pago. Ese total queda fijo en la autorización;
no cambia automáticamente cuando Correo modifica sus tarifas.

La revista y el circuito internacional de PayPal se mantienen para una etapa
posterior. No se implementó Pago en Destino ni contra reembolso.

## Alta y configuración

1. Crear la cuenta en https://micorreo.correoargentino.com.ar/register.
2. Solicitar las credenciales de **API MiCorreo** para pruebas y producción en
   https://www.correoargentino.com.ar/MiCorreo/public/contact.
3. Obtener el ID de cliente en Mi Cuenta → Mi Perfil → Información de la cuenta
   → Datos de facturación.
4. Cargar variables del servidor en el entorno de desarrollo y del despliegue:

| Variable | Valor |
|---|---|
| `CORREO_API_USER` | Usuario de API entregado por Correo |
| `CORREO_API_PASSWORD` | Contraseña de API, exclusivamente en el servidor |
| `CORREO_CUSTOMER_ID` | ID de la cuenta de MiCorreo |
| `CORREO_API_ENV` | `test` para pruebas; `production` para producción |
| `CORREO_ORIGIN_POSTAL_CODE` | `7600` — despacho desde Mar del Plata, confirmado por el titular |
| `CORREO_PACKAGES_JSON` | Peso en gramos y medidas en cm de cada plan ya embalado |

Paquete máximo informado por el titular para las suscripciones: menos de 1 kg,
formato entre A5 y A4, con espesor máximo de 5 cm. Se configura una cotización
conservadora de **1000 g y 21 × 30 × 5 cm** para los tres planes. El largo A4
(29,7 cm) se redondea hacia arriba porque la integración exige centímetros enteros.
Verificar que el embalaje exterior respete estos límites antes de operar.

```json
{
  "inicial": {
    "weight": 1000,
    "height": 5,
    "width": 21,
    "length": 30
  },
  "miembro": {
    "weight": 1000,
    "height": 5,
    "width": 21,
    "length": 30
  },
  "socio-premium": {
    "weight": 1000,
    "height": 5,
    "width": 21,
    "length": 30
  }
}
```

Sin credenciales, origen y medidas válidas, el
checkout conserva los datos y ofrece reintentar o coordinar por email; no cobra.
El listado oficial solo incluye sucursales activas que admiten retiro.
Las coordenadas se usan para distancias aproximadas en línea recta, dentro de
la provincia elegida; la ubicación del comprador se procesa en su navegador.

## Base de datos y despacho

Aplicar `supabase/migrations/20261007030000_branch_pickup_shipments.sql` antes de
usar el administrador actualizado. Cada destino conserva código, nombre,
dirección y destinatario. El registro de la suscripción conserva tarifa de
envío y total mensual; los pagos siguen guardando el importe real cobrado.
Los pedidos anteriores conservan sus destinos y requieren coordinación si se
quiere cambiar la modalidad de entrega. No se actualizan cobros existentes.

En `/admin/tienda`, registrar el seguimiento al despachar. El administrador
manda el aviso de despacho y permite reintentar un email fallido. Confirmar
la llegada con el seguimiento de Correo y registrar la **fecha límite real**
antes de marcar Disponible para retirar. Esa acción envía dirección,
seguimiento, documentación y fecha límite. Luego marcar retirado o devuelto.
No se infiere la llegada ni el plazo a partir de la fecha de despacho.

La integración consulta sucursales y cotizaciones. La compra del rótulo y el
despacho se realizan en MiCorreo. La consulta automática de seguimiento,
recordatorios de vencimiento y los cambios de sucursal por autoservicio quedan
para una siguiente etapa. Para cambiar la sucursal, el cliente responde al
email; hay que coordinar el próximo envío y cualquier cambio de precio antes
de modificar una autorización recurrente.

## Verificación con la cuenta real

- Confirmar resultados para CABA, Buenos Aires y una provincia del interior.
- Comprobar que el total mostrado coincida con la autorización de Mercado Pago.
- Cambiar provincia y verificar que se quite la selección anterior.
- Confirmar que una sucursal inactiva o una tarifa modificada no permitan pagar.
- Probar vuelta desde tarjeta a datos, errores y reintentos sin perder el destino.
- Confirmar avisos de despacho y retiro con destinatarios de prueba.

## El manual API PAQ.AR v2

El manual `apiPaqAr-v2.pdf` (abril 2023) describe otra API: usa
`agreement` + `API-Key`, gestionados por el área Comercial. No son el usuario
y contraseña de API MiCorreo. Sus endpoints documentados incluyen sucursales,
pedidos, rótulos y seguimiento, pero el manual no documenta cotizaciones.
Para este checkout solicitar acceso a **API MiCorreo** (sucursales + tarifas)
o confirmar con Correo la alternativa de cotización para el acuerdo PAQ.AR.
No intercambiar estas credenciales ni usar la contraseña de la cuenta web
como contraseña de API sin confirmación de Correo.
