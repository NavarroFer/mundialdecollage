// An Argentine mobile number however people write it — 11 2345-6789,
// 011 15 2345-6789, (223) 15 412-3456, +54 9 11 2345 6789 — as the
// +54 9 form Correo's notices and WhatsApp take, or null when it isn't one.
// The national number is always 10 digits: area code (11, or 3–4 digits
// starting with 2 or 3) plus the subscriber number. A landline has the same
// shape, so this can't tell the two apart.
export function argentineMobile(raw: string): string | null {
  if (!/^\+?[\d\s().-]+$/.test(raw.trim())) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('54')) digits = digits.slice(2).replace(/^9/, '')
  digits = digits.replace(/^0/, '')
  // The «15» mobile prefix goes after the area code.
  if (digits.length === 12) {
    const area = digits.startsWith('11') ? [2] : [3, 4]
    const at = area.find((length) => digits.slice(length, length + 2) === '15')
    if (at === undefined) return null
    digits = digits.slice(0, at) + digits.slice(at + 2)
  }
  return /^(11\d{8}|[23]\d{9})$/.test(digits) ? `+54 9 ${digits}` : null
}
