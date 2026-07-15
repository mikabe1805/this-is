import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(root, 'v2')
const vite = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this builder through npm so the locked npm CLI is available.')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: appRoot, stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', code => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}.`)))
  })
}

await run(process.execPath, [npmCli, 'run', 'typecheck'])
await run(process.execPath, [vite, 'build', '--outDir', '.emulator-dist', '--emptyOutDir'], {
  env: {
    ...process.env,
    VITE_FIREBASE_API_KEY: 'fake',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-this-is-v2.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'demo-this-is-v2',
    VITE_FIREBASE_STORAGE_BUCKET: 'demo-this-is-v2.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    VITE_USE_FIREBASE_EMULATORS: 'true',
    VITE_EMULATOR_PLACES_STUB: 'true',
    VITE_PLACES_NEW_KEY: 'emulator-only-no-google',
    VITE_GROUP_PHOTOS_ENABLED: 'false',
  },
})
