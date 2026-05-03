import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party deps out of the entry chunk so they're
        // cacheable independently of app code (one slow firebase update
        // doesn't bust the cache for the whole app, and vice versa).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase/firestore')) return 'firebase-firestore'
          if (id.includes('firebase/auth')) return 'firebase-auth'
          if (id.includes('firebase/storage')) return 'firebase-storage'
          if (id.includes('firebase/')) return 'firebase-other'
          if (id.includes('react-dom') || id.includes('scheduler')) return 'react-dom'
          if (id.includes('react-router')) return 'react-router'
          if (id.includes('@heroicons')) return 'heroicons'
          return undefined
        },
      },
    },
  },
})
