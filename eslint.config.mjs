import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  // Agent worktrees are full checkouts of other branches (with their own
  // builds); linting them isn't this tree's job.
  { ignores: ['.claude/**'] },
]

export default eslintConfig
