import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  // Reuse the v1 repo-root .env.local (VITE_FIREBASE_*, VITE_PLACES_NEW_KEY…)
  // so v2 needs zero secret duplication. This is config sharing, not code
  // sharing — the no-imports-from-v1 rule stands.
  envDir: resolve(here, '..'),
  build: {
    target: 'es2022',
  },
})
