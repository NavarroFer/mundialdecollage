import { createHash } from 'node:crypto'
import { AwsClient } from 'aws4fetch'

// Cloudflare R2 (S3 API, no egress fees): where app/api/img keeps every photo
// it has fetched and every size it has made, so a CDN miss reads from here
// instead of downloading the original from Supabase Storage again — that
// egress is what ran Supabase's quota out. The bucket stays private.
export type ImageStore = {
  get(key: string): Promise<Buffer | null>
  put(key: string, body: Buffer, contentType: string): Promise<void>
}

// Null where the R2_* variables aren't set (local dev, a preview without
// them): app/api/img then resizes straight from Storage, as before.
export function imageStore(): ImageStore | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null

  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
  const url = (key: string) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

  return {
    async get(key) {
      const response = await client.fetch(url(key), { cache: 'no-store' })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`R2 get ${key}: ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    },
    async put(key, body, contentType) {
      const response = await client.fetch(url(key), {
        method: 'PUT',
        body: new Uint8Array(body),
        // R2 rejects chunked S3 PUTs (411), so declare the byte length
        // explicitly when the body came from Node's Buffer.
        headers: { 'Content-Type': contentType, 'Content-Length': String(body.length) },
      })
      if (!response.ok) throw new Error(`R2 put ${key}: ${response.status}`)
    },
  }
}

// Folder for one version of one Storage photo. The version (its ETag) is part
// of the key because a few paths are overwritten in place (legacy-<id>.jpg on
// a re-sync): a new upload lands in a new folder instead of serving the old
// photo forever. Hex and digits only, so keys never need URL-encoding.
export function imageStorePrefix(src: string, version: string): string | null {
  const safeVersion = version.replace(/[^a-zA-Z0-9]/g, '')
  if (!safeVersion) return null
  return `img/${createHash('sha256').update(src).digest('hex')}/${safeVersion}`
}
