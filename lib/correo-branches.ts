/** Public branch data only. Never expose MiCorreo credentials or staff contacts. */
export type CorreoBranch = {
  code: string
  name: string
  address: string
  city: string
  locality: string
  province: string
  provinceCode: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  hours: string
}
export const CORREO_PROVINCES: Record<string, string> = {
  '06': 'B', '10': 'K', '22': 'H', '26': 'U', '02': 'C', '14': 'X', '18': 'W', '30': 'E',
  '34': 'P', '38': 'Y', '42': 'L', '46': 'F', '50': 'M', '54': 'N', '58': 'Q', '62': 'R',
  '66': 'A', '70': 'J', '74': 'D', '78': 'Z', '82': 'S', '86': 'G', '94': 'V', '90': 'T',
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function searchBranches(branches: CorreoBranch[], query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return branches.filter((branch) => {
    const haystack = normalize([branch.name, branch.address, branch.city, branch.locality, branch.postalCode].join(' '))
    return words.every((word) => haystack.includes(word))
  })
}

/** Straight-line distance, never represented as walking/driving distance. */
export function branchDistance(branch: CorreoBranch, location: { latitude: number; longitude: number }) {
  if (branch.latitude === null || branch.longitude === null) return null
  const radians = (n: number) => n * Math.PI / 180
  const a = Math.sin(radians(branch.latitude - location.latitude) / 2) ** 2
    + Math.cos(radians(location.latitude)) * Math.cos(radians(branch.latitude))
    * Math.sin(radians(branch.longitude - location.longitude) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
}
