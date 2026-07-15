import assert from 'node:assert/strict'
import { shouldHideDock } from '../.domain-test/domain/navigation.js'

for (const [pathname, search] of [
  ['/onboarding', ''],
  ['/terms', ''],
  ['/privacy', ''],
  ['/gi/group-invite-token', ''],
  ['/groups/new', ''],
  ['/g/group-id', ''],
  ['/g/group-id/', ''],
  ['/p/place-id', '?pick=pick-id'],
  ['/p/place-id', '?edit=details'],
]) assert.equal(shouldHideDock(pathname, search), true, `${pathname}${search} should be focused`)

for (const [pathname, search] of [
  ['/together', ''],
  ['/saved', ''],
  ['/people', ''],
  ['/p/place-id', ''],
  ['/settings', ''],
  ['/i/retired-invite', ''],
  ['/with/retired-person', ''],
  ['/with/retired-person/plan', ''],
]) assert.equal(shouldHideDock(pathname, search), false, `${pathname}${search} should keep navigation`)

console.log('✓ focused group decisions suppress navigation; retired pair links keep the dock')
