import { rowPurchase } from '@/lib/payments/purchases'
import { formatAddress, formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'
import { site } from '@/lib/site'

// Preventa de la Revista 1ª Edición (app/revista).
export const magazinePurchase = rowPurchase({ table: 'magazine_orders', label: 'magazine payment', sendReceipt: sendMagazineReceipt })

// «¡Gracias! Tu revista está reservada» (compra_revista).
function sendMagazineReceipt(orderId: string) {
  return sendReceiptOnce('magazine_orders', orderId, 'compra_revista', async (db) => {
    const { data: order } = await db.from('magazine_orders')
      .select('id, name, email, quantity, amount, currency, shipping_address')
      .eq('id', orderId)
      .single()
    if (!order) return null
    const address = order.shipping_address as Record<string, unknown>
    const locale = localeFromCountry(typeof address?.country_code === 'string' ? address.country_code : 'AR')
    const total = formatMoney(Number(order.amount), order.currency, locale)
    return {
      to: order.email,
      name: order.name,
      locale,
      tags: {
        ejemplares: String(order.quantity),
        total,
        direccion: formatAddress(address, locale),
        pedido: order.id.slice(0, 8).toUpperCase(),
        fecha_salida: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(site.magazine.releaseISO)),
      },
      summary: `Revista · ${order.quantity} ${order.quantity === 1 ? 'ejemplar' : 'ejemplares'} · ${total} · ${order.name}`,
    }
  })
}
