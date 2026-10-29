// The «consult about this work» button of a Club gallery: the member's
// WhatsApp number or web address, turned into a link. The address is the
// member's own text (they can write it straight to the database), so it is
// checked again here: a link that is not http(s) is never made.

export type ClubContact = { whatsapp?: string; url?: string }

/** The address as a safe http(s) link, or null. */
export function safeWebAddress(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** wa.me wants the number as digits only, country code included. */
export function whatsappLink(number: string | null | undefined, message: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '')
  if (digits.length < 6 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/** WhatsApp when the member gave a number, else their web address, else nothing. */
export function consultLink(contact: ClubContact | undefined, message: string): string | null {
  if (!contact) return null
  return whatsappLink(contact.whatsapp, message) ?? safeWebAddress(contact.url)
}
