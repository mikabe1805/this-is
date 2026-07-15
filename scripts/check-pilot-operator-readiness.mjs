import { readFile } from 'node:fs/promises'
import { validatePilotOperatorReadiness } from './pilot-operator-readiness-core.mjs'

const file = new URL('../pilot-operator-readiness.local.json', import.meta.url)
if (process.argv.includes('--help')) {
  console.log('Copy pilot-operator-readiness.template.json to pilot-operator-readiness.local.json, complete every reviewed field, then run npm run pilot:preflight.')
  console.log('The ignored local file contains operator readiness only. Never add participant names, contacts, places, notes, or evidence.')
  process.exit(0)
}

try {
  const input = JSON.parse(await readFile(file, 'utf8'))
  const issues = validatePilotOperatorReadiness(input)
  if (issues.length > 0) {
    console.error('BLOCK participant contact. Operator readiness is incomplete:')
    issues.forEach(issue => console.error(`- ${issue}`))
    process.exit(1)
  }
  console.log('PASS pilot operator preflight. Participant contact preparation is complete.')
  console.log('This confirms readiness metadata only; it is not legal approval, consent, recruitment, or pilot evidence.')
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error('BLOCK participant contact. pilot-operator-readiness.local.json is missing.')
    console.error('Copy pilot-operator-readiness.template.json, complete it after review, and keep the local file out of Git.')
  } else {
    console.error('BLOCK participant contact. The local readiness file is not valid JSON.')
  }
  process.exit(1)
}
