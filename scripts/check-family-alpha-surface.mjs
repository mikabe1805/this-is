import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { familyAlphaSurfaceIssues } from './family-alpha-surface-core.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const source = path => readFileSync(resolve(root, path), 'utf8')
const surface = json('family-alpha-deploy-surface.json')
const issues = familyAlphaSurfaceIssues({
  surface,
  firebaseConfig: json('firebase.family-alpha.json'),
  functionsSource: source('v2-functions/src/index.ts'),
})

if (issues.length) {
  console.error('Family-alpha deploy surface is blocked:')
  issues.forEach(issue => console.error(`- ${issue}`))
  process.exit(1)
}

console.log(`Family-alpha surface is structurally bounded to ${surface.deployFunctions.length} reviewed Functions.`)
console.log('placePhoto and its PLACES_SERVER_KEY secret are excluded. No network request or deployment was performed.')
