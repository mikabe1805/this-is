import { readFile } from 'node:fs/promises'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore'

setLogLevel('silent')

const projectId = 'demo-this-is-family-alpha'
const [host = '127.0.0.1', portText = '8080'] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':')
const rules = await readFile(new URL('../.family-alpha-rules/firestore.rules', import.meta.url), 'utf8')
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host, port: Number(portText), rules },
})

try {
  const claimed = testEnv.authenticatedContext('family-member', { familyAlpha: true }).firestore()
  const unclaimed = testEnv.authenticatedContext('signed-in-outsider').firestore()
  const falseClaim = testEnv.authenticatedContext('former-member', { familyAlpha: false }).firestore()
  const guest = testEnv.unauthenticatedContext().firestore()

  await assertSucceeds(setDoc(doc(claimed, 'users', 'family-member'), { following: [] }))
  await assertSucceeds(getDoc(doc(claimed, 'users', 'family-member')))
  await assertFails(setDoc(doc(unclaimed, 'users', 'signed-in-outsider'), { following: [] }))
  await assertFails(getDoc(doc(unclaimed, 'users', 'family-member')))
  await assertFails(getDoc(doc(falseClaim, 'users', 'family-member')))
  await assertFails(getDoc(doc(guest, 'users', 'family-member')))

  console.log('PASS family-alpha rules admit only identities with familyAlpha == true')
} finally {
  await testEnv.cleanup()
}
