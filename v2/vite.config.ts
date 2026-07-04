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
    rollupOptions: {
      output: {
        // Pin the firebase SDK (+ its grpc/protobuf transport) to one chunk so
        // the split is DETERMINISTIC. Firebase is dynamic-only here (the auth
        // listener + lazy pages), so this chunk loads on demand and never rides
        // in the entry chunk. Without this, Rollup's default async-chunk
        // partitioning occasionally folded firebase into a shared chunk,
        // swinging the entry from ~85kB to ~100kB gzip between identical builds.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('/firebase/') ||
            id.includes('/@firebase/') ||
            id.includes('/@grpc/') ||
            id.includes('protobufjs') ||
            id.includes('/@protobufjs/')
          ) {
            return 'firebase'
          }
          // Statically-imported vendors: own cacheable chunks so app edits don't
          // bust them (react-dom stays in entry — it's the unavoidable first
          // paint core). This also keeps the entry chunk size deterministic.
          if (id.includes('/react-router') || id.includes('/@remix-run/')) return 'react-router'
          if (id.includes('/@tanstack/')) return 'tanstack'
          if (id.includes('/minisearch/')) return 'minisearch'
          return undefined
        },
      },
    },
  },
})
