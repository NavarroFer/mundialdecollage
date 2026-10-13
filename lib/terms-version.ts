import { site } from '@/lib/site'

// Al cambiar los Términos y Condiciones (lib/terms.ts) de forma sustancial,
// subí la versión: el check del onboarding guarda cuál aceptó cada persona
// (tabla terms_acceptances).
export const TERMS_VERSION = '2026-10-13'

// El PDF con las bases + los términos (scripts/build-bases-pdf.mts).
export const TERMS_PDF_URL = site.basesPdfUrl
