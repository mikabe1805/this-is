export const EMULATOR_PROJECT_ID = 'demo-this-is-v2'

const HTTP_FUNCTION_NAMES = [
  'resolveMapsUrl',
  'placePhoto',
  'searchPlanAreas',
  'exportMyData',
  'deleteMyAccount',
  'createGroup',
  'createGroupInvite',
  'listGroupInvites',
  'acceptGroupInvite',
  'revokeGroupInvite',
  'saveGroupQuickStart',
  'shareGroupSignal',
  'leaveGroup',
  'migratePairToGroup',
  'createGroupPick',
  'updateGroupDraftPass',
  'closeGroupPick',
  'revokePickReceipt',
]

const FUNCTION_CONTEXT = `^/(?:${HTTP_FUNCTION_NAMES.join('|')})(?:/|$)`
const FUNCTION_EMULATOR_ORIGIN = 'http://127.0.0.1:5001'
const FUNCTION_EMULATOR_PREFIX = `/${EMULATOR_PROJECT_ID}/us-central1`

/**
 * A Vite development server is an operational write surface. It may only load
 * the tracked demo configuration that connects Auth and Firestore to emulators.
 * Production builds remain possible; serving them is handled by reviewed
 * Firebase deployment tooling, not a direct local Vite command.
 */
export function assertSafeLocalServe({ command, mode, env, isPreview = false }) {
  if (isPreview && env.THIS_IS_VERIFIED_EMULATOR_PREVIEW !== 'true') {
    throw new Error('Refusing Vite preview because it can serve a bundle built for another backend. Run the root npm run preview command instead.')
  }
  const verifiedGroupUiPlacesStub = command === 'serve'
    && !isPreview
    && env.THIS_IS_VERIFIED_GROUP_UI_DEV === 'true'
    && env.VITE_EMULATOR_PLACES_STUB === 'true'
    && env.VITE_PLACES_NEW_KEY === 'emulator-only-no-google'
  const issues = mode === 'emulator' ? [
    ...(env.VITE_USE_FIREBASE_EMULATORS === 'true'
      ? [] : ['VITE_USE_FIREBASE_EMULATORS must be true']),
    ...(env.VITE_FIREBASE_PROJECT_ID === EMULATOR_PROJECT_ID
      ? [] : [`VITE_FIREBASE_PROJECT_ID must be ${EMULATOR_PROJECT_ID}`]),
    ...(env.VITE_EMULATOR_PLACES_STUB === 'false' || verifiedGroupUiPlacesStub
      ? [] : ['VITE_EMULATOR_PLACES_STUB must be false']),
    ...(env.VITE_PLACES_ENABLED === 'false'
      ? [] : ['VITE_PLACES_ENABLED must be false']),
    ...(env.VITE_GROUP_PHOTOS_ENABLED === 'false'
      ? [] : ['VITE_GROUP_PHOTOS_ENABLED must be false']),
  ] : command === 'serve' ? ['mode must be emulator'] : []

  if (issues.length > 0) {
    throw new Error(
      `Refusing unsafe Vite emulator/serve configuration: ${issues.join('; ')}. `
      + 'Run the canonical npm run dev command instead.',
    )
  }
}

/** Same-origin development routes for the canonical HTTP Functions emulator. */
export function createEmulatorFunctionProxy() {
  return {
    [FUNCTION_CONTEXT]: {
      target: FUNCTION_EMULATOR_ORIGIN,
      changeOrigin: false,
      rewrite: path => `${FUNCTION_EMULATOR_PREFIX}${path}`,
    },
    '^/pick(?:/|$)': {
      target: FUNCTION_EMULATOR_ORIGIN,
      changeOrigin: false,
      rewrite: path => `${FUNCTION_EMULATOR_PREFIX}/pickReceipt${path}`,
    },
  }
}

export const emulatorHttpFunctionNames = Object.freeze([...HTTP_FUNCTION_NAMES])
