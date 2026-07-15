import { readFile } from 'node:fs/promises'
import { evaluatePhase0Decision } from './phase0-decision-core.mjs'

if (process.argv.includes('--help')) {
  console.log('Usage: npm run phase0:decision -- --evidence <anonymous-local.json>')
  console.log('Prints aggregate gates only; never prints anonymous codes or raw observations.')
  process.exit(0)
}

const index = process.argv.indexOf('--evidence')
const evidencePath = index >= 0 ? process.argv[index + 1] : undefined
if (!evidencePath) {
  console.error('--evidence is required. Run with --help for usage.')
  process.exit(1)
}

try {
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
  console.log(JSON.stringify(evaluatePhase0Decision(evidence), null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Phase 0 evaluation failed.')
  process.exit(1)
}

