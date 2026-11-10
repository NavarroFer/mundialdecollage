// A file's type comes from its extension, so a Photoshop file renamed .jpg
// still arrives as `image/jpeg`. Reading the first bytes tells what it is:
// a PSD that got through once and broke the 3D gallery (sharp and every
// browser refuse it). Same four formats as ALLOWED_IMAGE_TYPES.
export function hasImageSignature(bytes: Uint8Array): boolean {
  const at = (offset: number, text: string) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0))
  return (
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) || // JPEG
    (bytes[0] === 0x89 && at(1, 'PNG\r\n')) || // PNG
    at(0, 'GIF8') || // GIF
    (at(0, 'RIFF') && at(8, 'WEBP')) // WebP
  )
}

/** Browser: whether the picked file really is a JPEG, PNG, GIF or WebP. */
export async function isRealImage(file: Blob): Promise<boolean> {
  return hasImageSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
}
