import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import {
  assertSafeLocalServe,
  createEmulatorFunctionProxy,
} from './vite.safety.mjs'
import {
  FAMILY_ALPHA_VITE_ENV_PREFIX,
  assertSafeFamilyAlphaBuild,
  familyAlphaViteDefines,
  parseFamilyAlphaEnvText,
} from './family-alpha.safety.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const envDir = resolve(here, '..')

export default defineConfig(({ command, mode, isPreview }) => {
  const familyAlpha = mode === 'family-alpha'
  const familyAlphaPath = resolve(envDir, '.env.family-alpha.local')
  const dedicatedFamilyAlphaEnv = familyAlpha && existsSync(familyAlphaPath)
    ? parseFamilyAlphaEnvText(readFileSync(familyAlphaPath, 'utf8'))
    : {}
  // Family alpha never invokes Vite's env loader. Its dedicated file is the
  // only source record; envDir/envPrefix below also disable Vite's automatic
  // root-file and ambient VITE_* exposure during the actual bundle build.
  const env = familyAlpha ? dedicatedFamilyAlphaEnv : loadEnv(mode, envDir, '')
  assertSafeLocalServe({ command, mode, env, isPreview })
  assertSafeFamilyAlphaBuild({
    command,
    mode,
    env: dedicatedFamilyAlphaEnv,
    ambientEnv: process.env,
  })

  return {
    plugins: [react()],
    // Normal/emulator lanes retain the root env behavior. Family alpha disables
    // all automatic env loading and receives only the explicit definitions
    // derived from its validated dedicated file.
    envDir: familyAlpha ? false : envDir,
    envPrefix: familyAlpha ? FAMILY_ALPHA_VITE_ENV_PREFIX : 'VITE_',
    define: familyAlpha ? familyAlphaViteDefines(dedicatedFamilyAlphaEnv) : undefined,
    server: {
      proxy: createEmulatorFunctionProxy(),
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          // Pin the Firebase SDK (+ its grpc/protobuf transport) to one chunk so
          // the split is deterministic. Firebase is dynamic-only here (the auth
          // listener + lazy pages), so this chunk loads on demand and never rides
          // in the entry chunk. Without this, Rollup's default async-chunk
          // partitioning occasionally folded Firebase into a shared chunk,
          // swinging the entry size between identical builds.
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
            // Statically imported vendors get their own cacheable chunks so app
            // edits do not bust them and the entry size remains deterministic.
            if (id.includes('/react-router') || id.includes('/@remix-run/')) return 'react-router'
            if (id.includes('/@tanstack/')) return 'tanstack'
            if (id.includes('/minisearch/')) return 'minisearch'
            return undefined
          },
        },
      },
    },
  }
})
