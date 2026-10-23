// The people who walk the gallery: Microsoft Rocketbox avatars (MIT license),
// converted to compressed glTF ahead of time (scripts/avatars) and served from
// the gallery's public R2 bucket, never through Vercel. Without
// NEXT_PUBLIC_GALLERY_ASSETS_URL (local dev, or switched off) everyone keeps
// the drawn figures in Person.tsx, which also stand in while an avatar loads.

export type CastMember = { name: string; sex: 'f' | 'm' }

const woman = (name: string): CastMember => ({ name, sex: 'f' })
const man = (name: string): CastMember => ({ name, sex: 'm' })

/** Picked by Fer from the Rocketbox library: adults, like the site's 30+ audience. */
export const CAST: CastMember[] = [
  woman('Female_Adult_01'), woman('Female_Adult_04'), woman('Female_Adult_07'), woman('Female_Adult_09'),
  woman('Female_Adult_11'), woman('Female_Adult_12'), woman('Female_Adult_13'), woman('Female_Adult_17'),
  woman('Business_Female_01'), woman('Business_Female_02'), woman('Business_Female_03'), woman('Business_Female_04'),
  man('Male_Adult_02'), man('Male_Adult_03'), man('Male_Adult_04'), man('Male_Adult_08'),
  man('Business_Male_01'), man('Business_Male_07'),
]

/** Who walks each scripted route (visitorRoutes.ts), mixed in age, skin tone and clothes. */
export const SCRIPTED_CAST: Record<string, string> = {
  'visitor-01': 'Female_Adult_11',
  'visitor-02': 'Male_Adult_03',
  'visitor-03': 'Business_Female_01',
  'visitor-04': 'Male_Adult_04',
  'visitor-05': 'Female_Adult_09',
}

/** Real visitors get one of the others, so nobody meets a scripted visitor's twin. */
export const REMOTE_CAST = CAST.filter(({ name }) => !Object.values(SCRIPTED_CAST).includes(name))

export const castMember = (name: string | undefined) => CAST.find((member) => member.name === name)

/** Bump when the files change (scripts/avatars/build.mjs): browsers keep each URL for good. */
export const AVATARS_VERSION = 'v1'
const ASSETS = process.env.NEXT_PUBLIC_GALLERY_ASSETS_URL?.replace(/\/+$/, '')

export const avatarsEnabled = Boolean(ASSETS)
export const avatarUrl = (name: string) => `${ASSETS}/avatars/${AVATARS_VERSION}/${name}.glb`
/** A 150×190 portrait for the avatar picker. */
export const portraitUrl = (name: string) => `${ASSETS}/avatars/${AVATARS_VERSION}/thumbs/${name}.webp`
/** Walk and idle, shared by everyone of that sex (the skeletons match bone for bone). */
export const animationsUrl = (sex: CastMember['sex']) => `${ASSETS}/avatars/${AVATARS_VERSION}/animations-${sex}.glb`
/** Squatting, for visitors holding Control: a file of its own, so a body still walks without it. */
export const crouchUrl = (sex: CastMember['sex']) => `${ASSETS}/avatars/${AVATARS_VERSION}/crouch-${sex}.glb`
