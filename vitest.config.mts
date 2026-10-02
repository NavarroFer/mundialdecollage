import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Agent worktrees are full checkouts of other branches; their tests
    // aren't this tree's.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
