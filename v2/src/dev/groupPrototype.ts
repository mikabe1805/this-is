import type { QueryClient } from '@tanstack/react-query'
import type { FriendSave, FriendUser, Tag } from '../domain/signals'
import type { ActiveGroupPickSummary, GroupCircle, RecentGroupPickSummary } from '../domain/groups'
import type { GroupMemberTaste } from '../domain/groupRecommendation'
import {
  PAIR_PROTOTYPE_STORAGE_KEY,
  prototypeActivePickStorageKey,
  prototypeRecentPickStorageKey,
  prototypeSignalStorageKey,
} from '../lib/prototypeMode'
import { setSession } from '../state/session'
import { buildDurablePlaceMemory, categoryPrimaryType, type UserPlaceCategory } from '../domain/placeMemory'

const me: FriendUser = { uid: 'group-mika', displayName: 'Mika', avatarHex: '#6b333c' }
const vivian: FriendUser = { uid: 'group-vivian', displayName: 'Vivian', avatarHex: '#5e4a53' }
const ari: FriendUser = { uid: 'group-ari', displayName: 'Ari', avatarHex: '#54473d' }
const dev: FriendUser = { uid: 'group-dev', displayName: 'Dev', avatarHex: '#875043' }
const lena: FriendUser = { uid: 'group-lena', displayName: 'Lena', avatarHex: '#7c3f4c' }
const noa: FriendUser = { uid: 'group-noa', displayName: 'Noa', avatarHex: '#6f5a50' }

function signal(
  user: FriendUser,
  placeId: string,
  tag: Tag,
  ts: number,
  name: string,
  primaryType: string,
  note?: string,
): FriendSave {
  const category: UserPlaceCategory = /cafe|coffee|bakery/.test(primaryType)
    ? 'coffee'
    : /bar|wine|cocktail|brewery/.test(primaryType)
      ? 'drinks'
      : /museum|park|activity|theater|gallery/.test(primaryType)
        ? 'activity'
        : 'food'
  const memory = buildDurablePlaceMemory({ placeId, userLabel: name, category })!
  return {
    id: `${user.uid}__${placeId}`,
    uid: user.uid,
    placeId,
    tag,
    visibility: 'circle',
    ts,
    note,
    memory,
    place: { name: memory.label, primaryType: categoryPrimaryType(memory.category), hex: memory.hex },
    user,
  }
}

const sunlight = ['group-sunlight', 'Sunlight Coffee', 'cafe', 'Greenpoint', '#6f4a2f'] as const
const fieldStudy = ['group-field-study', 'Field Study Wine Bar', 'wine_bar', 'Fort Greene', '#4e302d'] as const
const publicRecord = ['group-public-record', 'Public Record', 'restaurant', 'Gowanus', '#573a2e'] as const
const radio = ['group-radio', 'Radio Bakery', 'bakery', 'Greenpoint', '#5d4437'] as const
const supperClub = ['group-supper-club', 'Supper Club', 'restaurant', 'User-confirmed', '#744936'] as const
const glassHouse = ['group-glass-house', 'Glass House', 'gallery', 'User-confirmed', '#39464b'] as const
const nightjar = ['group-nightjar', 'Nightjar Coffee', 'cafe', 'User-confirmed', '#5a3c31'] as const

type PlaceFixture = readonly [string, string, string, string, string]
const at = (user: FriendUser, place: PlaceFixture, tag: Tag, ts: number, note?: string) => {
  const value = signal(user, place[0], tag, ts, place[1], place[2], note)
  return place[0] === supperClub[0]
    ? {
        ...value,
        memory: { ...value.memory!, area: 'Cresskill, NJ' },
        observations: {
          quiet: { value: 'yes' as const, observedAt: ts, audience: 'group' as const, source: 'user_authored' as const },
        },
      }
    : value
}

const fridayTastes = [
  { uid: me.uid, name: me.displayName, saves: [at(me, sunlight, 'want', 60), at(me, fieldStudy, 'want', 45), at(me, radio, 'want', 20)] },
  { uid: vivian.uid, name: vivian.displayName, saves: [at(vivian, sunlight, 'want', 62), at(vivian, fieldStudy, 'loved', 55, 'Low light, enough room to actually talk.'), at(vivian, radio, 'want', 30)] },
  { uid: ari.uid, name: ari.displayName, saves: [at(ari, sunlight, 'want', 58), at(ari, fieldStudy, 'want', 42)] },
  { uid: dev.uid, name: dev.displayName, saves: [at(dev, sunlight, 'want', 57), at(dev, publicRecord, 'loved', 48, 'Good for a group and easy to linger.')], vetoPlaceIds: [radio[0]] },
  { uid: lena.uid, name: lena.displayName, saves: [at(lena, sunlight, 'want', 59), at(lena, radio, 'want', 26)] },
  { uid: noa.uid, name: noa.displayName, saves: [] },
]

const brooklynTastes = fridayTastes.slice(0, 4).map((taste, index) => ({
  ...taste,
  vetoPlaceIds: [],
  saves: [at([me, vivian, ari, dev][index], radio, index === 1 ? 'loved' : 'want', 70 - index)],
}))

const evidenceLabTastes: GroupMemberTaste[] = [
  {
    uid: me.uid,
    name: me.displayName,
    saves: [at(me, supperClub, 'want', 90), at(me, nightjar, 'want', 88)],
  },
  {
    uid: vivian.uid,
    name: vivian.displayName,
    saves: [at(vivian, supperClub, 'want', 89)],
    quickStart: {
      uid: vivian.uid,
      categoryHints: ['coffee'],
      constraintHints: ['quiet'],
      permissionVersion: 1,
    },
  },
  {
    uid: ari.uid,
    name: ari.displayName,
    saves: [at(ari, glassHouse, 'loved', 87, 'Ari would bring the group here.')],
  },
]

const sparseFamilyTastes: GroupMemberTaste[] = [
  { uid: me.uid, name: me.displayName, saves: [] },
  { uid: vivian.uid, name: vivian.displayName, saves: [at(vivian, nightjar, 'want', 91)] },
  { uid: ari.uid, name: ari.displayName, saves: [] },
  { uid: dev.uid, name: dev.displayName, saves: [] },
]

const sparseFamilyGroup: GroupCircle = {
  id: 'prototype-sparse-family',
  name: 'Family Sunday',
  status: 'active',
  memberUids: [me.uid, vivian.uid, ari.uid, dev.uid],
  members: [me, vivian, ari, dev],
  permissionVersion: 1,
  membershipLocked: true,
  projectionCount: 1,
  tastes: sparseFamilyTastes,
  changeLabel: 'One place is waiting on another reason',
}

export const GROUP_PROTOTYPE_ID = 'prototype-friday-table'

const groups: GroupCircle[] = [
  {
    id: GROUP_PROTOTYPE_ID,
    name: 'Friday Table',
    status: 'active',
    memberUids: [me.uid, vivian.uid, ari.uid, dev.uid, lena.uid, noa.uid],
    members: [me, vivian, ari, dev, lena, noa],
    permissionVersion: 1,
    membershipLocked: true,
    projectionCount: fridayTastes.reduce((count, taste) => count + taste.saves.length, 0),
    tastes: fridayTastes,
    changeLabel: '2 new signals since last Friday',
  },
  {
    id: 'prototype-brooklyn-friends',
    name: 'Brooklyn Friends',
    status: 'active',
    memberUids: [me.uid, vivian.uid, ari.uid, dev.uid],
    members: [me, vivian, ari, dev],
    permissionVersion: 1,
    membershipLocked: true,
    projectionCount: brooklynTastes.reduce((count, taste) => count + taste.saves.length, 0),
    tastes: brooklynTastes,
    changeLabel: 'One place everyone wants',
  },
  {
    id: 'prototype-evidence-lab',
    name: 'Candidate Evidence Lab',
    status: 'active',
    memberUids: [me.uid, vivian.uid, ari.uid],
    members: [me, vivian, ari],
    permissionVersion: 1,
    membershipLocked: true,
    projectionCount: evidenceLabTastes.reduce((count, taste) => count + taste.saves.length, 0),
    tastes: evidenceLabTastes,
    changeLabel: 'Three evidence modes, no paid enrichment',
  },
  {
    id: 'prototype-zero-history',
    name: 'Empty Table',
    status: 'active',
    memberUids: [me.uid, vivian.uid],
    members: [me, vivian],
    permissionVersion: 1,
    membershipLocked: false,
    projectionCount: 0,
    tastes: [
      { uid: me.uid, name: me.displayName, saves: [] },
      { uid: vivian.uid, name: vivian.displayName, saves: [] },
    ],
    changeLabel: 'No shared place signals yet',
  },
  {
    id: 'prototype-forming-family',
    name: 'Family Sunday',
    status: 'forming',
    memberUids: [me.uid],
    members: [me],
    permissionVersion: 1,
    membershipLocked: false,
    projectionCount: 0,
    tastes: [{ uid: me.uid, name: me.displayName, saves: [] }],
    changeLabel: 'Waiting for someone to join',
  },
]

const legacyCirclePlaceIds = new Set(fridayTastes[0].saves.map(save => save.placeId))
const PERSONAL_SEED_MARKER = '__this_is_group_prototype_personal_seeded'

const personalSaves = (() => {
  const latestByPlace = new Map<string, FriendSave>()
  for (const save of groups.flatMap(group =>
    group.tastes.find(taste => taste.uid === me.uid)?.saves ?? [])) {
    const existing = latestByPlace.get(save.placeId)
    if (existing && existing.ts >= save.ts) continue
    const observations = save.observations
      ? Object.fromEntries(Object.entries(save.observations).map(([key, observation]) => [
          key,
          { ...observation, audience: 'private' as const },
        ])) as FriendSave['observations']
      : undefined
    latestByPlace.set(save.placeId, {
      ...save,
      visibility: legacyCirclePlaceIds.has(save.placeId) ? 'circle' : 'private',
      ...(observations ? { observations } : {}),
    })
  }
  return [...latestByPlace.values()].sort((a, b) => b.ts - a.ts)
})()

export function installGroupPrototype(queryClient: QueryClient): void {
  window.sessionStorage.setItem(PAIR_PROTOTYPE_STORAGE_KEY, 'group')
  if (window.sessionStorage.getItem(PERSONAL_SEED_MARKER) !== '1') {
    for (const save of personalSaves) {
      const canonical = { ...save }
      delete canonical.place
      delete canonical.user
      window.sessionStorage.setItem(prototypeSignalStorageKey(me.uid, save.placeId), JSON.stringify(canonical))
    }
    window.sessionStorage.setItem(PERSONAL_SEED_MARKER, '1')
  }
  const prototypeParams = new URLSearchParams(window.location.search)
  const signedOutInvite = prototypeParams.get('prototypeAuth') === 'invite-new'
  const unresolvedAuth = prototypeParams.get('prototypeAuth') === 'unknown'
  const formingOnly = prototypeParams.get('prototypeState') === 'forming-only'
  const sparseOnly = prototypeParams.get('prototypeState') === 'sparse-only'
  if (unresolvedAuth) {
    setSession({ status: 'unknown', user: null })
  } else if (signedOutInvite) {
    setSession({ status: 'signed-out', user: null })
  } else {
    setSession({ status: 'signed-in', user: { uid: me.uid, displayName: me.displayName, photoURL: null } })
    queryClient.setQueryData(['userDoc', me.uid], current => current ?? {
      displayName: me.displayName,
      avatarHex: me.avatarHex,
      onboardedAt: Date.now(),
    })
  }
  const prototypeGroups = sparseOnly
    ? [sparseFamilyGroup]
    : formingOnly
      ? groups.filter(group => group.id === 'prototype-forming-family')
      : groups
  const restoredGroups = prototypeGroups.map(group => {
    try {
      const activeValue = window.sessionStorage.getItem(prototypeActivePickStorageKey(group.id))
      const recentValue = window.sessionStorage.getItem(prototypeRecentPickStorageKey(group.id))
      return {
        ...group,
        ...(activeValue ? { activePick: JSON.parse(activeValue) as ActiveGroupPickSummary } : {}),
        ...(recentValue ? { recentPick: JSON.parse(recentValue) as RecentGroupPickSummary } : {}),
      }
    } catch {
      window.sessionStorage.removeItem(prototypeActivePickStorageKey(group.id))
      window.sessionStorage.removeItem(prototypeRecentPickStorageKey(group.id))
      return group
    }
  })
  queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => current ?? restoredGroups)
  queryClient.setQueryData(['mySaves', me.uid], current => current ?? personalSaves)
  queryClient.setQueryData(['connections', me.uid], current => current ?? [])

  const allSignals = prototypeGroups.flatMap(group => group.tastes.flatMap(taste => taste.saves))
  const uniqueSignals = [...new Map(allSignals.map(save => [`${save.uid}__${save.placeId}`, save])).values()]
  const uniquePlaces = [...new Map(uniqueSignals.flatMap(save => save.place ? [[save.placeId, save.place] as const] : [])).entries()]
  queryClient.setQueryData(['placeCatalog'], current => current ?? uniquePlaces.map(([id, place]) => ({
      id,
      ...place,
      photoHex: place.hex,
      vibeTags: [],
      savedCount: uniqueSignals.filter(save => save.placeId === id).length,
    })))
  for (const [placeId] of uniquePlaces) {
    queryClient.setQueryData(
      ['placeSaves', placeId, [me.uid]],
      current => current ?? uniqueSignals.filter(save => save.placeId === placeId),
    )
  }
}
