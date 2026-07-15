import { readFile } from 'node:fs/promises'
import { evaluateGroupPilotDecision } from './group-pilot-decision-core.mjs'

if (process.argv.includes('--help')) {
  console.log('Usage: npm run group-pilot:decision -- --observations <anonymous.json> --summary <aggregate.json>')
  console.log('Prints aggregate group gates only; never prints circle codes or raw observations.')
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
  console.log(JSON.stringify(evaluateGroupPilotDecision(observations, summary), null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Group pilot evaluation failed.')
  process.exit(1)
}
