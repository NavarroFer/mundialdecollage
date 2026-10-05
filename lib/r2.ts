import { createHash } from 'node:crypto'
import { AwsClient } from 'aws4fetch'

// Cloudflare R2 (S3 API, no egress fees): where app/api/img keeps every photo
// it has fetched and every size it has made, so a CDN miss reads from here
// instead of downloading the original from Supabase Storage again — that
// egress is what ran Supabase's quota out. The bucket stays private.
export type ImageStore = {
  get(key: string): Promise<Buffer | null>
  put(key: string, body: Buffer, contentType: string): Promise<void>
  // Lets a deployment made after the cache was populated recover the newest
  // version before the `current` marker existed.
  findLatestFolder?(root: string): Promise<string | null>
}

// Current uploads use a timestamp in their filename, for example
// `user/1760000000000-0.jpg` or `admin/id/1760000000000.jpg`: never
// overwritten, so what's made from one can be kept for good. Not so
// legacy/<id>.jpg, which is intentionally overwritten.
export function isVersionedSource(src: string): boolean {
  return /\/\d{13}(?:-\d+)?\.[a-zA-Z0-9]+(?:\?|$)/.test(src)
}

export function imageStoreRoot(src: string): string {
  return `img/${createHash('sha256').update(src).digest('hex')}`
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
  const bucketUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`
  const url = (key: string) => `${bucketUrl}/${key}`

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
    async findLatestFolder(root) {
      const query = new URLSearchParams({ 'list-type': '2', prefix: `${root}/` })
      const response = await client.fetch(`${bucketUrl}?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`R2 list ${root}: ${response.status}`)
      const xml = await response.text()
      let newest: { folder: string; modified: number } | null = null
      for (const match of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>[\s\S]*?<\/Contents>/g)) {
        const folder = match[1].match(/^(img\/[a-f0-9]{64}\/[a-zA-Z0-9]+)\//)?.[1]
        const modified = Date.parse(match[2])
        if (folder && Number.isFinite(modified) && (!newest || modified > newest.modified)) newest = { folder, modified }
      }
      return newest?.folder ?? null
    },
  }
}

// Folder for one version of one Storage photo. The version (its ETag) is part
// of the key because a few paths are overwritten in place (legacy-<id>.jpg on
// a re-sync): a new upload lands in a new folder instead of serving the old
// photo forever. Hex and digits only, so keys never need URL-encoding.
export function imageStorePrefix(src: string, version: string): string | null {
  // ETags may contain punctuation (and Last-Modified contains spaces). Hash
  // their exact value rather than stripping those characters: stripping could
  // make two distinct versions share a folder.
  if (!version) return null
  return `${imageStoreRoot(src)}/${createHash('sha256').update(version).digest('hex')}`
}
