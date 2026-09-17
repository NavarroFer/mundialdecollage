import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// eslint-config-next ships flat-config-ready arrays directly (no FlatCompat
// needed with this version). `npm run lint` (`eslint .`) requires this file
// to exist under ESLint 9 — it was missing from the repo entirely.
const eslintConfig = [...nextCoreWebVitals]

export default eslintConfig
