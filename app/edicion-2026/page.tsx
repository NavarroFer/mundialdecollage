import { redirect } from 'next/navigation'

// The edition archive will return once there is a curated selection.
// Until then, old links lead back to the live artwork mosaic.
export default function EditionPage() {
  redirect('/#participantes')
}
