import { readFile } from 'node:fs/promises'
import { evaluatePilotDecision } from './pilot-decision-core.mjs'

if (process.argv.includes('--help')) {
  console.log('Usage: npm run pilot:decision -- --observations <anonymous.json> --summary <aggregate.json>')
  console.log('Prints aggregate gates and a protocol recommendation; never prints pair codes or raw observations.')
  process.exit(0)
}

const argument = name => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const observationsPath = argument('--observations')
const summaryPath = argument('--summary')
if (!observationsPath || !summaryPath) {
  console.error('Both --observations and --summary are required. Run with --help for usage.')
  process.exit(1)
}

try {
  const [observations, summary] = await Promise.all([
    readFile(observationsPath, 'utf8').then(JSON.parse),
    readFile(summaryPath, 'utf8').then(JSON.parse),
  ])
  console.log(JSON.stringify(evaluatePilotDecision(observations, summary), null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Pilot evaluation failed.')
  process.exit(1)
}
