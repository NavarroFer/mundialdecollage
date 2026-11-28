import { createHash } from 'node:crypto'
import { certificateDetails, certificatePostImage, diplomaJpeg, diplomaPdf, diplomaPreview, type CertificateInput } from '@/lib/certificate'
import { imageStore, type ImageStore } from '@/lib/r2'
import { photoVersion } from '@/lib/share-image-cache'

// A certificate costs seconds of CPU to draw (the diploma is a 3508×2480
// satori render plus a JPEG encode), and its page shows it and links to it
// several times over. Each file is drawn once and kept in R2 under a hash of
// everything it prints (lib/certificate.tsx's certificateDetails), the obra
// photo's version and the template itself (CERTIFICATE_TEMPLATE, a hash of
// its source made at build, next.config.mjs): an artist who corrects their
// name gets a new one, and so does everyone when the design changes.
const TEMPLATE = process.env.CERTIFICATE_TEMPLATE ?? 'dev'

export type CertificateFile = 'pdf' | 'post' | 'preview'

const FILES = {
  pdf: { ext: 'pdf', type: 'application/pdf' },
  post: { ext: 'png', type: 'image/png' },
  preview: { ext: 'jpg', type: 'image/jpeg' },
  diploma: { ext: 'jpg', type: 'image/jpeg' },
} as const

type Stored = keyof typeof FILES
type Drawn = { body: Buffer; complete: boolean }

export async function certificateFile(file: CertificateFile, input: CertificateInput): Promise<{ body: Buffer; contentType: string }> {
  const store = imageStore()
  const version = store ? await photoVersion(input.finalist.imageUrl) : null
  // A photo without a known version could change under the same key: draw
  // it fresh rather than risk keeping a stale one.
  const cache = store && version ? { store, base: [TEMPLATE, certificateDetails(input), input.finalist.imageUrl, version] } : null

  const kept = (name: Stored, draw: () => Promise<Drawn>) => keptFile(cache, name, draw)
  const diploma = () => kept('diploma', async () => {
    const { jpeg, complete } = await diplomaJpeg(input)
    return { body: jpeg, complete }
  })

  const drawn = file === 'post'
    ? await kept('post', async () => {
        const { png, complete } = await certificatePostImage(input)
        return { body: png, complete }
      })
    : file === 'preview'
      ? await kept('preview', async () => {
          const source = await diploma()
          return { body: await diplomaPreview(source.body), complete: source.complete }
        })
      : await kept('pdf', async () => {
          const source = await diploma()
          return { body: Buffer.from(await diplomaPdf(source.body, input)), complete: source.complete }
        })
  return { body: drawn.body, contentType: FILES[file].type }
}

// Read back from R2, or drawn and kept there. One missing its obra photo
// (it couldn't be loaded) isn't kept, or it would stick.
async function keptFile(cache: { store: ImageStore; base: unknown[] } | null, name: Stored, draw: () => Promise<Drawn>): Promise<Drawn> {
  if (!cache) return draw()
  const key = `certificate/${createHash('sha256').update(JSON.stringify([...cache.base, name])).digest('hex')}.${FILES[name].ext}`
  try {
    const stored = await cache.store.get(key)
    if (stored) return { body: stored, complete: true }
  } catch (error) {
    console.error('certificate: R2 read failed', key, error)
  }
  const drawn = await draw()
  if (drawn.complete) {
    try {
      await cache.store.put(key, drawn.body, FILES[name].type)
    } catch (error) {
      console.error('certificate: R2 write failed', key, error)
    }
  }
  return drawn
}
