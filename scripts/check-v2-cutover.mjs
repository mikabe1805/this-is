import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCutoverEvidence } from './cutover-evidence-core.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')
const read = path => readFileSync(resolve(root, path), 'utf8')
const json = path => JSON.parse(read(path))

const rootPackage = json('package.json')
const hosting = json('firebase.v2.json')
const firebaseProjectAliases = json('.firebaserc').projects ?? {}
const v2Indexes = json('v2/firestore.indexes.json')
const v2Rules = read('v2/firestore.rules')
const liveRules = read('firestore.rules')
const readme = read('README.md')
const agentGuide = read('AGENTS.md')
const migrationPlanner = read('scripts/plan-v2-migration.mjs')
const erasurePlanner = read('scripts/plan-v1-erasure.mjs')
const externalArchivePlanner = read('scripts/plan-external-v2-archive.mjs')
const v2Functions = read('v2-functions/src/index.ts')
const nodeVersionPin = read('.node-version').trim()
const nvmPin = read('.nvmrc').trim()
const cutoverEvidenceTemplate = read('cutover-evidence.template.json')
const cutoverContract = read('docs/product-reset/CUTOVER.md')
const groupDirection = read('docs/product-reset/GROUP_DIRECTION.md')
const phase0Protocol = read('docs/product-reset/PHASE_0_CONCIERGE_TEST.md')
const pilotOperatorKit = read('docs/product-reset/PILOT_OPERATOR_KIT.md')
const appRoutes = read('v2/src/App.tsx')
const connectionsData = read('v2/src/data/connections.ts')
const placesData = read('v2/src/lib/places.ts')
const pinVisual = read('v2/src/components/PinVisual.tsx')
const groupPage = read('v2/src/pages/Group.tsx')
const baseCss = read('v2/src/styles/base.css')
const componentsCss = read('v2/src/styles/components.css')
const createGroupPage = read('v2/src/pages/CreateGroup.tsx')
const closeupPage = read('v2/src/pages/Closeup.tsx')
const saveToastHost = read('v2/src/components/SaveToastHost.tsx')
const pickContextChips = read('v2/src/components/PickContextChips.tsx')
const groupInvitePage = read('v2/src/pages/GroupInvite.tsx')
const groupQuickStartComponent = read('v2/src/components/GroupQuickStart.tsx')
const groupQuickStartDomain = read('v2/src/domain/groupQuickStart.ts')
const groupLiveStateDomain = read('v2/src/domain/groupLiveState.ts')
const groupDraftDomain = read('v2/src/domain/groupDraft.ts')
const groupDraftServer = read('v2-functions/src/group-draft.ts')
const groupDraftHook = read('v2/src/lib/useGroupDraftPasses.ts')
const groupsDomain = read('v2/src/domain/groups.ts')
const groupsData = read('v2/src/data/groups.ts')
const queriesData = read('v2/src/data/queries.ts')
const socialData = read('v2/src/data/social.ts')
const analyticsData = read('v2/src/data/analytics.ts')
const candidateCardDomain = read('v2/src/domain/candidateCard.ts')
const groupRecommendationDomain = read('v2/src/domain/groupRecommendation.ts')
const groupCandidateCard = read('v2/src/components/GroupCandidateCard.tsx')
const groupInviteManager = read('v2/src/components/GroupInviteManager.tsx')
const termsPagePath = resolve(root, 'v2/src/pages/Terms.tsx')
const privacyPagePath = resolve(root, 'v2/src/pages/Privacy.tsx')
const termsPage = existsSync(termsPagePath) ? read('v2/src/pages/Terms.tsx') : ''
const privacyPage = existsSync(privacyPagePath) ? read('v2/src/pages/Privacy.tsx') : ''
const candidateSeed = read('v2/scripts/seed-candidates.mjs')
const curatedSeed = read('v2/scripts/seed-curated.mjs')
const candidatesData = read('v2/src/data/candidates.ts')
const savesData = read('v2/src/data/saves.ts')
const userData = read('v2/src/data/user.ts')
const groupLifecycle = read('v2-functions/src/group-lifecycle.ts')
const projectionSync = read('v2-functions/src/projection-sync.ts')
const groupPick = read('v2-functions/src/group-pick.ts')
const groupRecommendationParity = read('scripts/group-recommendation-parity.test.mjs')
const pilotOperatorReadinessCore = read('scripts/pilot-operator-readiness-core.mjs')
const pilotOperatorReadinessCli = read('scripts/check-pilot-operator-readiness.mjs')
const pilotOperatorReadinessTemplate = read('pilot-operator-readiness.template.json')
const pickReceiptServer = read('v2-functions/src/pick-receipt.ts')
const placePhoto = read('v2-functions/src/place-photo.ts')
const groupPhotosData = read('v2/src/data/groupPhotos.ts')
const groupPhotoHook = read('v2/src/lib/useGroupPlacePhoto.ts')
const openCatalogDomain = read('v2/src/domain/openCatalog.ts')
const openCatalogDomainTest = read('v2/src/domain/openCatalog.test.ts')
const openCatalogExtractionDomain = read('v2/src/domain/openCatalogExtraction.ts')
const openCatalogArtifactDomain = read('v2/src/domain/openCatalogArtifact.ts')
const openDiscoveryDomain = read('v2/src/domain/openDiscovery.ts')
const openDiscoveryDomainTest = read('v2/src/domain/openDiscovery.test.ts')
const openCatalogManifestCore = read('scripts/open-catalog-manifest-core.mjs')
const openCatalogPlanner = read('scripts/plan-open-catalog.mjs')
const openCatalogAcquisitionCore = read('scripts/open-catalog-acquisition-core.mjs')
const openCatalogAcquisitionCli = read('scripts/extract-open-catalog.mjs')
const openCatalogService = read('v2-functions/src/open-catalog.ts')
const openCatalogAliasService = read('v2-functions/src/open-catalog-alias.ts')
const openCatalogAliasServiceTest = read('v2-functions/src/open-catalog-alias.test.ts')
const firestoreRulesTest = read('v2/tests/firestore-rules.mjs')
const areaGazetteerManifestCore = read('scripts/area-gazetteer-manifest-core.mjs')
const areaGazetteerPlanner = read('scripts/plan-area-gazetteer.mjs')
const areaGazetteerService = read('v2-functions/src/area-gazetteer.ts')
const finalShortlistDomain = read('v2/src/domain/finalShortlist.ts')
const groupUiVerifier = read('scripts/check-v2-group-ui.mjs')
const groupDraftUiVerifier = read('scripts/check-v2-group-draft-ui.mjs')
const zeroApiLinkVerifier = read('scripts/check-v2-zero-api-link-ui.mjs')
const groupPrototype = read('v2/src/dev/groupPrototype.ts')
const emulatorBuilder = read('scripts/build-v2-emulator.mjs')
const zeroApiBuilder = read('scripts/build-v2-zero-api.mjs')
const v2Ignore = read('v2/.gitignore')
const addPage = read('v2/src/pages/Add.tsx')
const addPrivateSavesReadIsAudienceProtected = /useMySaves\s*\(\s*\{\s*enabled\s*:\s*searchReady\s*&&\s*\(\s*discoveryMode\s*\|\|\s*Boolean\s*\(\s*groupId\s*\)\s*\)\s*,?\s*\}\s*\)/m.test(addPage)
const placeMemoryConfirmation = read('v2/src/components/PlaceMemoryConfirmation.tsx')
const dataAndAccount = read('v2/src/components/DataAndAccount.tsx')
const accountData = read('v2/src/data/account.ts')
const accountDeletionOperationDomain = read('v2/src/domain/accountDeletionOperation.ts')
const settingsPage = read('v2/src/pages/Settings.tsx')
const picksData = read('v2/src/data/picks.ts')
const mapsUrlDomain = read('v2/src/domain/mapsUrl.ts')
const webManifest = json('v2/public/manifest.webmanifest')
const togetherPage = read('v2/src/pages/Together.tsx')
const savedPage = read('v2/src/pages/Saved.tsx')
const searchPage = read('v2/src/pages/Search.tsx')
const peoplePage = read('v2/src/pages/People.tsx')
const onboardingPage = read('v2/src/pages/Onboarding.tsx')
const dockComponent = read('v2/src/components/Dock.tsx')
const planAreaDomain = read('v2/src/domain/planArea.ts')
const planAreaGazetteerDomain = read('v2/src/domain/planAreaGazetteer.ts')
const planAreaGazetteerIndexDomain = read('v2/src/domain/planAreaGazetteerIndex.ts')
const v2Package = json('v2/package.json')
const canonicalMain = read('v2/src/main.tsx')
const canonicalWorkerManager = read('v2/src/lib/killLegacySW.ts')
const canonicalWorker = read('v2/public/sw-v2.js')
const precacheWriter = read('v2/scripts/write-precache-manifest.mjs')
const hostingVerifier = read('scripts/check-v2-hosting.mjs')
const viteConfig = read('v2/vite.config.ts')
const viteSafety = read('v2/vite.safety.mjs')
const familyAlphaSafety = read('v2/family-alpha.safety.mjs')
const familyAlphaChecker = read('scripts/check-family-alpha-env.mjs')
const familyAlphaTemplate = read('.env.family-alpha.example')
const familyAlphaFirebase = json('firebase.family-alpha.json')
const familyAlphaSurface = json('family-alpha-deploy-surface.json')
const familyAlphaSurfaceChecker = read('scripts/check-family-alpha-surface.mjs')
const familyAlphaFunctionsBuilder = read('scripts/build-family-alpha-functions.mjs')
const familyAlphaRulesBuilder = read('scripts/build-family-alpha-rules.mjs')
const familyAlphaRulesCore = read('scripts/family-alpha-rules-core.mjs')
const familyAlphaArtifactChecker = read('scripts/check-family-alpha-artifact.mjs')
const familyAlphaArtifactCore = read('scripts/family-alpha-artifact-core.mjs')
const v2FunctionsIgnore = read('v2-functions/.gitignore')
const emulatorEnv = read('.env.emulator')
const firebaseBootstrap = read('v2/src/lib/firebaseImpl.ts')
const releaseChannelMark = read('v2/src/components/ReleaseChannelMark.tsx')
const cutoverEvidencePath = resolve(root, 'cutover-evidence.local.json')
let cutoverEvidenceIssues = ['cutover-evidence.local.json is missing.']
if (existsSync(cutoverEvidencePath)) {
  try {
    cutoverEvidenceIssues = validateCutoverEvidence(JSON.parse(readFileSync(cutoverEvidencePath, 'utf8')))
  } catch {
    cutoverEvidenceIssues = ['cutover-evidence.local.json is not valid JSON.']
  }
}
const executableRules = source => source
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const legacyOnlyCommands = [
  'firebase:init',
  'db:setup',
  'db:seed',
  'db:deploy-rules',
  'db:deploy-indexes',
  'db:deploy',
  'db:reset',
  'setup',
  'audit:places',
  'status:screens',
  'status:screens:placeholder',
  'status:update',
  'status:pr',
  'status:ui',
  'test:maps',
  'test:smoke',
]

const firebaseDeployCommands = Object.entries(rootPackage.scripts ?? {})
  .filter(([, command]) => /\bfirebase(?:\.cmd)?\s+deploy\b/.test(command))

const structural = [
  ['default dev command delegates to v2', rootPackage.scripts?.dev === 'npm --prefix v2 run dev'],
  ['canonical local serving is full-stack emulator-only and refuses prebuilt Vite preview',
    v2Package.scripts?.dev?.includes('--only auth,firestore,functions') === true
      && v2Package.scripts?.dev?.includes('--project demo-this-is-v2') === true
      && v2Package.scripts?.dev?.includes('vite --mode emulator') === true
      && v2Package.scripts?.['build:emulator']?.includes('vite build --mode emulator') === true
      && rootPackage.scripts?.preview === 'npm run firebase:serve'
      && rootPackage.scripts?.['firebase:serve']?.includes('build:emulator') === true
      && rootPackage.scripts?.['firebase:serve']?.includes('--only auth,firestore,functions,hosting') === true
      && emulatorEnv.includes('VITE_FIREBASE_PROJECT_ID=demo-this-is-v2')
      && emulatorEnv.includes('VITE_USE_FIREBASE_EMULATORS=true')
      && emulatorEnv.includes('VITE_PLACES_ENABLED=false')
      && emulatorEnv.includes('VITE_GROUP_PHOTOS_ENABLED=false')
      && viteConfig.includes('assertSafeLocalServe({ command, mode, env, isPreview })')
      && viteSafety.includes('if (isPreview &&')
      && viteSafety.includes("THIS_IS_VERIFIED_EMULATOR_PREVIEW !== 'true'")
      && groupDraftUiVerifier.includes("THIS_IS_VERIFIED_EMULATOR_PREVIEW: 'true'")
      && groupDraftUiVerifier.includes("'--outDir', '.emulator-dist', '--mode', 'emulator'")
      && viteSafety.includes("mode === 'emulator'")
      && viteSafety.includes('VITE_FIREBASE_PROJECT_ID must be ${EMULATOR_PROJECT_ID}')
      && viteSafety.includes("VITE_PLACES_ENABLED must be false")
      && viteSafety.includes("VITE_GROUP_PHOTOS_ENABLED must be false")
      && viteSafety.includes('createEmulatorFunctionProxy')
      && firebaseBootstrap.includes("connectAuthEmulator(auth, 'http://127.0.0.1:9199'")],
  ['family-alpha build preparation is isolated, exact-surface, claim-gated, artifact-verified, and has no deploy path',
    rootPackage.scripts?.['family-alpha:check'] === 'node scripts/check-family-alpha-env.mjs'
      && rootPackage.scripts?.['family-alpha:surface'] === 'node scripts/check-family-alpha-surface.mjs'
      && rootPackage.scripts?.['family-alpha:functions']?.includes('build-family-alpha-functions.mjs') === true
      && rootPackage.scripts?.['family-alpha:rules'] === 'node scripts/build-family-alpha-rules.mjs'
      && rootPackage.scripts?.['family-alpha:verify-rules']?.includes('--project demo-this-is-family-alpha') === true
      && rootPackage.scripts?.['family-alpha:verify-rules']?.includes('v2/tests/family-alpha-rules.mjs') === true
      && rootPackage.scripts?.['family-alpha:backend'] === 'npm run family-alpha:functions && npm run family-alpha:rules'
      && rootPackage.scripts?.['family-alpha:artifact'] === 'node scripts/check-family-alpha-artifact.mjs'
      && rootPackage.scripts?.['family-alpha:build']?.includes('npm run family-alpha:check') === true
      && rootPackage.scripts?.['family-alpha:build']?.includes('npm run family-alpha:surface') === true
      && rootPackage.scripts?.['family-alpha:build']?.includes('npm run family-alpha:backend') === true
      && v2Package.scripts?.['build:family-alpha']?.includes('vite build --mode family-alpha --outDir .family-alpha-dist') === true
      && v2Package.scripts?.['build:family-alpha']?.includes('write-precache-manifest.mjs .family-alpha-dist') === true
      && v2Package.scripts?.['build:family-alpha']?.endsWith('node ../scripts/check-family-alpha-artifact.mjs') === true
      && v2Ignore.split(/\r?\n/).includes('.family-alpha-dist')
      && v2Ignore.split(/\r?\n/).includes('.family-alpha-rules')
      && v2FunctionsIgnore.split(/\r?\n/).includes('.family-alpha-deploy')
      && hosting.hosting?.public === 'v2/dist'
      && familyAlphaFirebase.hosting?.public === 'v2/.family-alpha-dist'
      && familyAlphaFirebase.firestore?.rules === 'v2/.family-alpha-rules/firestore.rules'
      && familyAlphaFirebase.functions?.length === 1
      && familyAlphaFirebase.functions[0]?.source === 'v2-functions/.family-alpha-deploy'
      && familyAlphaFirebase.functions[0]?.codebase === 'family-alpha'
      && familyAlphaFirebase.emulators === undefined
      && familyAlphaSurface.schemaVersion === 2
      && familyAlphaSurface.authClaim === 'familyAlpha'
      && familyAlphaSurface.excludedFunctions?.includes('placePhoto')
      && familyAlphaSurface.excludedFunctions?.includes('migratePairToGroup')
      && !familyAlphaSurface.deployFunctions?.includes('placePhoto')
      && !familyAlphaSurface.hostingFunctions?.includes('placePhoto')
      && !familyAlphaFirebase.hosting?.rewrites?.some(rewrite => rewrite.function?.functionId === 'placePhoto')
      && familyAlphaSurfaceChecker.includes('familyAlphaSurfaceIssues')
      && familyAlphaFunctionsBuilder.includes("entry = removeEndpoint(entry, 'placePhoto', 'searchPlanAreas')")
      && familyAlphaFunctionsBuilder.includes("entry = removeEndpoint(entry, 'migratePairToGroup', 'updateGroupDraftPass')")
      && familyAlphaFunctionsBuilder.includes('identity.${surface.authClaim} !== true')
      && familyAlphaFunctionsBuilder.includes('packageJson.name !== packageLock.name')
      && familyAlphaRulesBuilder.includes("resolve(root, 'v2/.family-alpha-rules')")
      && familyAlphaRulesBuilder.includes('familyAlphaRulesIssues')
      && familyAlphaRulesCore.includes("claimName !== 'familyAlpha'")
      && familyAlphaRulesCore.includes("&& '${claimName}' in request.auth.token")
      && familyAlphaRulesCore.includes('request.auth.token.${claimName} == true')
      && familyAlphaArtifactChecker.includes("resolve(root, 'v2', '.family-alpha-dist')")
      && familyAlphaArtifactCore.includes("'/placePhoto'")
      && familyAlphaTemplate.includes('THIS_IS_FAMILY_ALPHA_PROJECT_ID=your-separate-project-id')
      && familyAlphaTemplate.includes('VITE_GROUP_PHOTOS_ENABLED=false')
      && familyAlphaChecker.includes("'.env.family-alpha.local'")
      && familyAlphaChecker.includes('parseFamilyAlphaEnvText')
      && familyAlphaChecker.includes('familyAlphaAmbientKeys(process.env)')
      && familyAlphaSafety.includes("forbidden:legacy-project")
      && familyAlphaSafety.includes("forbidden:demo-project")
      && familyAlphaSafety.includes("'.env.local'")
      && familyAlphaSafety.includes("key.startsWith(FAMILY_ALPHA_VITE_ENV_PREFIX)")
      && familyAlphaSafety.includes("FAMILY_ALPHA_ENV_KEYS.filter(key => key.startsWith('VITE_'))")
      && familyAlphaSafety.includes('Object.fromEntries(FAMILY_ALPHA_VITE_ENV_KEYS.map')
      && familyAlphaSafety.includes('FAMILY_ALPHA_VITE_ENV_PREFIX')
      && familyAlphaSafety.includes('familyAlphaViteDefines')
      && familyAlphaSafety.includes('Refusing ambient family-alpha environment:')
      && viteConfig.includes("const familyAlpha = mode === 'family-alpha'")
      && viteConfig.includes("const env = familyAlpha ? dedicatedFamilyAlphaEnv : loadEnv(mode, envDir, '')")
      && viteConfig.includes('ambientEnv: process.env')
      && viteConfig.includes('envDir: familyAlpha ? false : envDir')
      && viteConfig.includes("envPrefix: familyAlpha ? FAMILY_ALPHA_VITE_ENV_PREFIX : 'VITE_'")
      && viteConfig.includes('define: familyAlpha ? familyAlphaViteDefines(dedicatedFamilyAlphaEnv) : undefined')
      && !viteConfig.includes('resolvedEnv: env')
      && !viteConfig.includes('familyAlpha ? loadEnv')
      && rootPackage.scripts?.['family-alpha:deploy'] === undefined
      && rootPackage.scripts?.['family-alpha:serve'] === undefined
      && Object.entries(rootPackage.scripts ?? {}).filter(([name]) => name.startsWith('family-alpha:'))
        .every(([, command]) => !/\bfirebase(?:\.cmd)?\s+deploy\b/.test(command))
      && firebaseBootstrap.includes("releaseChannel === 'family-alpha'")
      && releaseChannelMark.includes('FAMILY ALPHA · PRIVATE DOGFOOD')
      && appRoutes.includes('<ReleaseChannelMark />')
      && componentsCss.includes('.release-channel-mark')],
  ['default build command covers the v2 app and its minimal backend', rootPackage.scripts?.build === 'npm --prefix v2 run build && npm --prefix v2-functions run build'],
  ['canonical cold-offline shell is content-addressed, owned-asset-only, and browser-proven',
    v2Package.scripts?.build === 'tsc -p tsconfig.json && vite build && node scripts/write-precache-manifest.mjs'
      && precacheWriter.includes("createHash('sha256')")
      && precacheWriter.includes(".filter(file => !['sw-v2.js', 'precache-manifest.json'].includes(path.basename(file)))")
      && canonicalWorker.includes("const CACHE_PREFIX = 'this-is-v2-shell-'")
      && canonicalWorker.includes("asset === '/index.html' || isOwnedStatic")
      && canonicalWorker.includes("if (request.method !== 'GET') return")
      && canonicalWorker.includes("if (url.origin !== self.location.origin) return")
      && canonicalWorker.includes("headers.set('X-This-Is-Offline-Shell', '1')")
      && !canonicalWorker.includes('cache.put(')
      && !canonicalWorker.includes("'/pick/'")
      && canonicalMain.includes('prepareCanonicalServiceWorker')
      && canonicalWorkerManager.includes("await clearCaches(production)")
      && canonicalWorkerManager.includes("updateViaCache: 'none'")
      && hosting.hosting?.headers?.some(item => item.source === '/sw-v2.js'
        && item.headers?.some(header => header.key === 'Cache-Control'
          && header.value.includes('no-cache') && header.value.includes('no-store')))
      && hostingVerifier.includes("x-this-is-offline-shell'] === '1'")
      && hostingVerifier.includes("The browser cache must contain exactly the generated owned-asset manifest and nothing else.")],
  ['default test command covers docs, app, backend, family-alpha boundaries, recommendation/catalog parity and acquisition, operator readiness, erasure/archive/catalog planning, Phase 0, pair/group pilot and cutover decisions, groups, production-mode draft sync, zero-API capture, data rights, observability, and group UI', rootPackage.scripts?.test === 'npm run docs:check && npm --prefix v2 test && npm --prefix v2-functions test && node scripts/family-alpha-surface-core.test.mjs && node scripts/family-alpha-rules-core.test.mjs && node scripts/family-alpha-artifact-core.test.mjs && node scripts/group-recommendation-parity.test.mjs && node scripts/open-catalog-artifact-parity.test.mjs && node scripts/open-catalog-alias-parity.test.mjs && node scripts/open-catalog-acquisition-core.test.mjs && node scripts/v1-erasure-core.test.mjs && node scripts/external-v2-archive-core.test.mjs && node scripts/pilot-operator-readiness-core.test.mjs && node scripts/phase0-decision-core.test.mjs && node scripts/pilot-decision-core.test.mjs && node scripts/group-pilot-decision-core.test.mjs && node scripts/cutover-evidence-core.test.mjs && node scripts/area-gazetteer-manifest-core.test.mjs && node scripts/open-catalog-manifest-core.test.mjs && npm run verify:groups && npm run verify:group-draft-ui && npm run verify:zero-api-link-ui && npm run verify:data-rights && npm run verify:observability && npm run verify:group-ui'],
  ['shared draft passes synchronize across two isolated production-mode clients',
    rootPackage.scripts?.['verify:group-draft-ui']?.includes('scripts/build-v2-emulator.mjs') === true
      && rootPackage.scripts?.['verify:group-draft-ui']?.includes('--only auth,firestore,functions') === true
      && rootPackage.scripts?.['verify:group-draft-ui']?.includes('check-v2-group-draft-ui.mjs') === true
      && emulatorBuilder.includes("'--outDir', '.emulator-dist'")
      && emulatorBuilder.includes("VITE_USE_FIREBASE_EMULATORS: 'true'")
      && emulatorBuilder.includes("VITE_EMULATOR_PLACES_STUB: 'true'")
      && emulatorBuilder.includes("VITE_PLACES_NEW_KEY: 'emulator-only-no-google'")
      && emulatorBuilder.includes("VITE_GROUP_PHOTOS_ENABLED: 'false'")
      && emulatorBuilder.includes("VITE_FIREBASE_PROJECT_ID: 'demo-this-is-v2'")
      && v2Ignore.split(/\r?\n/).includes('.emulator-dist')
      && (groupDraftUiVerifier.match(/browser\.newContext/g) ?? []).length === 2
      && groupDraftUiVerifier.includes("ownerPage.goto(`${origin}/g/${groupId}`")
      && !groupDraftUiVerifier.includes('prototype=group')
      && groupDraftUiVerifier.includes('Mika passed on Supper Club.')
      && groupDraftUiVerifier.includes('Vivian passed on Supper Club.')
      && groupDraftUiVerifier.includes("getByRole('button', { name: 'Food', exact: true })")
      && groupDraftUiVerifier.includes("getByRole('button', { name: 'Anything', exact: true })")
      && groupDraftUiVerifier.includes("getByRole('button', { name: 'Make this the Pick' }).count(), 0")
      && groupDraftUiVerifier.includes("getByRole('button', { name: 'Undo' }).count(), 0")
      && groupDraftUiVerifier.includes("collection('draftPasses').get()).size, 0")
      && groupDraftUiVerifier.includes('assert.deepEqual(errors, [])')],
  ['zero-API discovery and Maps-link capture are browser-proven without Google Places, Details, or resolver requests',
    rootPackage.scripts?.['verify:zero-api-link-ui'] === 'node scripts/build-v2-zero-api.mjs && v2\\node_modules\\.bin\\firebase.cmd emulators:exec --only auth,firestore --project demo-this-is-v2 --config firebase.v2.json "node scripts/check-v2-zero-api-link-ui.mjs"'
      && rootPackage.scripts?.test?.includes('npm run verify:zero-api-link-ui') === true
      && zeroApiBuilder.includes("'--outDir', '.zero-api-dist', '--emptyOutDir'")
      && zeroApiBuilder.includes("VITE_USE_FIREBASE_EMULATORS: 'true'")
      && zeroApiBuilder.includes("VITE_EMULATOR_PLACES_STUB: 'false'")
      && zeroApiBuilder.includes("VITE_PLACES_ENABLED: 'false'")
      && zeroApiBuilder.includes("VITE_GROUP_PHOTOS_ENABLED: 'false'")
      && v2Ignore.split(/\r?\n/).includes('.zero-api-dist')
      && zeroApiLinkVerifier.includes("path.join(appRoot, '.zero-api-dist', 'index.html')")
      && zeroApiLinkVerifier.includes("'--outDir', '.zero-api-dist', '--mode', 'emulator'")
      && zeroApiLinkVerifier.includes("viewport: { width: 390, height: 844 }")
      && zeroApiLinkVerifier.includes("url.hostname === 'places.googleapis.com'")
      && zeroApiLinkVerifier.includes("url.pathname === '/resolveMapsUrl'")
      && zeroApiLinkVerifier.includes("url.pathname.startsWith('/__this_is_emulator_places/')")
      && zeroApiLinkVerifier.includes("await context.route('https://places.googleapis.com/**'")
      && zeroApiLinkVerifier.includes("await context.route(`${origin}/resolveMapsUrl`")
      && zeroApiLinkVerifier.includes("name: 'Area for discovery'")
      && zeroApiLinkVerifier.includes("name: /Explore in Google Maps/")
      && zeroApiLinkVerifier.includes("mapsSearchUrl.searchParams.get('query'), 'coffee shops in Cresskill, NJ'")
      && zeroApiLinkVerifier.includes('Opening a zero-API discovery handoff must not create a save.')
      && zeroApiLinkVerifier.includes('zero-api-discovery-handoff-mobile.png')
      && zeroApiLinkVerifier.includes('Zero-API discovery must not call Places or the link resolver.')
      && zeroApiLinkVerifier.includes('An exact long link must be parsed locally without Places or resolver calls.')
      && zeroApiLinkVerifier.includes('Saving reviewed memory must not call Places or the link resolver.')
      && zeroApiLinkVerifier.includes('In Google Maps, open the exact place, tap Share, and paste that place link.')
      && zeroApiLinkVerifier.includes('Rejected links must fail closed without Places or resolver calls.')
      && zeroApiLinkVerifier.includes("assert.equal(saved.data().visibility, 'private')")
      && zeroApiLinkVerifier.includes('assert.deepEqual(errors, [])')],
  ['mobile group decision flow has a committed browser verifier',
    rootPackage.scripts?.['verify:group-ui'] === 'npm --prefix v2 run build && npm --prefix v2-functions run build && node scripts/check-v2-group-ui.mjs'
      && groupUiVerifier.includes("'--mode', 'emulator'")
      && groupUiVerifier.includes("THIS_IS_VERIFIED_GROUP_UI_DEV: 'true'")
      && groupUiVerifier.includes("VITE_EMULATOR_PLACES_STUB: 'true'")
      && groupUiVerifier.includes("VITE_PLACES_ENABLED: 'false'")
      && groupUiVerifier.includes("VITE_PLACES_NEW_KEY: 'emulator-only-no-google'")
      && viteSafety.includes("env.THIS_IS_VERIFIED_GROUP_UI_DEV === 'true'")
      && viteSafety.includes("env.VITE_PLACES_NEW_KEY === 'emulator-only-no-google'")
      && groupUiVerifier.includes('Onboarding Places proof must stay on the same-origin emulator stub.')
      && groupUiVerifier.includes("viewport: { width: 390, height: 844 }")
      && groupUiVerifier.includes("{ width: 320, height: 568 }")
      && groupUiVerifier.includes("{ width: 768, height: 1024 }")
      && groupUiVerifier.includes('Guest must increase the denominator without adding support.')
      && groupUiVerifier.includes('Not now must not create taste evidence or candidates.')
      && groupUiVerifier.includes('Quick start without an exact place signal must not invent a candidate.')
      && groupUiVerifier.includes('Not now must remain an immediate first-viewport completion path, not buried after optional taste work.')
      && groupUiVerifier.includes('Future-only Quick start constraints must stay collapsed on entry.')
      && groupUiVerifier.includes('Collapsed future hints must not appear as current-value work in the accessibility tree.')
      && groupUiVerifier.includes('These do not change current suggestions yet.')
      && groupUiVerifier.includes('Adding for a group must keep the canonical personal save private.')
      && groupUiVerifier.includes('One explicit group-added Want must wait for independent support.')
      && groupUiVerifier.includes('assert(lovedIntroductionCount === 1')
      && groupUiVerifier.includes('One explicit Love may introduce exactly one place to the group; found ${lovedIntroductionCount}.')
      && groupUiVerifier.includes('Add-to-group navigation must land at the group header')
      && groupUiVerifier.includes('A dismissed Pick must not remain closable.')
      && groupUiVerifier.includes('Pick dismissal confirmation must focus the safe Keep Pick open action first.')
      && groupUiVerifier.includes('Escape must close the Pick dismissal confirmation and restore its trigger.')
      && groupUiVerifier.includes('A visited Pick must not remain collectively dismissible after one person records taste.')
      && groupUiVerifier.includes('The Pick Maps handoff must be a bounded Google Maps place search')
      && groupUiVerifier.includes('Escape must close the pass confirmation and restore its trigger.')
      && groupUiVerifier.includes('Undo must restore focus to the returned candidate pass control.')
      && groupUiVerifier.includes('Changing context must start a fresh draft.')
      && groupUiVerifier.includes('Optional plan details must stay collapsed on a fresh group draft.')
      && groupUiVerifier.includes('The first truthful place name must be visible in the initial 390×844 decision viewport.')
      && groupPage.includes('people’s shared taste · no location profile.')
      && groupPage.includes('aria-label="Selected place confirmation"')
      && groupPage.includes('READY FOR GROUP PICK ·')
      && groupPage.includes('pickCommitButtonRef.current?.focus()')
      && groupPage.includes("document.querySelectorAll<HTMLButtonElement>('[data-select-place-id]')")
      && groupUiVerifier.includes('selection must move focus directly to its explicit commitment action.')
      && groupUiVerifier.includes('Choose another must restore focus to the exact candidate that opened the tray.')
      && componentsCss.includes('.group-resolution > .group-resolution-actions')
      && componentsCss.includes('grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr)')
      && groupUiVerifier.includes('selection tray must stay within its ${maxHeight}px evidence-aware height budget.')
      && groupUiVerifier.includes('selection actions must stay side by side at 390×844.')
      && groupUiVerifier.includes('Going offline after a warm load must not erase the visible shortlist.')
      && groupUiVerifier.includes('Reconnecting must retain the loaded shortlist while queries resume.')
      && groupUiVerifier.includes('Revoked group access must render no candidate or taste evidence.')
      && groupUiVerifier.includes('An unavailable place must not expose a save mutation control.')
      && closeupPage.includes("prototypeFailure('closeup-memory')")
      && closeupPage.includes("prototypeFailure('closeup-pick')")
      && closeupPage.includes('enabled: Boolean(id) && !placeLookupFailed')
      && closeupPage.includes("pick.status === 'visited' && isPickAttendee && !personalDataUnavailable")
      && groupUiVerifier.includes('A private-memory read failure must not masquerade as a missing provider place.')
      && groupUiVerifier.includes('A failed private-memory lookup must stop before paid Place Details.')
      && groupUiVerifier.includes('A cold Pick read must reveal no group identity.')
      && groupUiVerifier.includes('A visited Pick must not offer a personal outcome while private Keep is unavailable.')
      && groupUiVerifier.includes('Primary IA must remain exactly Together / Keep / People')
      && groupUiVerifier.includes('separate private link for each person next.')
      && groupUiVerifier.includes('Give your group a name.')
      && groupUiVerifier.includes('Group creation must wait for a deliberate group name.')
      && createGroupPage.includes("session.status === 'unknown'")
      && createGroupPage.includes('creationKey.current')
      && v2Functions.includes('groupCreationDocumentId')
      && groupUiVerifier.includes('An ambiguous group-creation response must preserve the exact reviewed name for retry.')
      && groupUiVerifier.includes('Unresolved authentication must not expose the group mutation form.')
      && read('scripts/check-v2-groups.mjs').includes('creation is authenticated and idempotent across an ambiguous response retry')
      && groupUiVerifier.includes('Creating or joining never exposes personal Keep.')
      && groupUiVerifier.includes('ONE LINK · ONE PERSON')
      && groupUiVerifier.includes('Make one-person link')
      && groupUiVerifier.includes('A private invite token must stay concealed until the organizer deliberately asks to inspect it.')
      && groupUiVerifier.includes('Show full link must preserve an exact manual-copy fallback.')
      && groupUiVerifier.includes('Show full link must remain touch-sized even though it is visually secondary.')
      && groupUiVerifier.includes('The organizer must be able to inspect the exact one-person link deliberately.')
      && groupUiVerifier.includes('Every recovered or newly created invite token must default to concealed.')
      && groupInviteManager.includes('pendingInviteKey')
      && groupInviteManager.includes('Trying again won’t reserve another seat.')
      && v2Functions.includes('groupInviteDocumentId')
      && groupUiVerifier.includes('Retrying an ambiguous invite response must reuse the same operation identity.')
      && read('scripts/check-v2-groups.mjs').includes('invite creation is idempotent and its preview contains bounded context only')
      && groupUiVerifier.includes('ONE PERSON · LINK 1')
      && groupUiVerifier.includes('Invite revocation must focus the safe Keep link action first.')
      && groupUiVerifier.includes('Revoking one link must preserve the other larger-group invitation.')
      && groupUiVerifier.includes('Manual revocation must remove the final usable invite link immediately.')
      && groupUiVerifier.includes('An ambiguous invite revocation must not claim that the link is unchanged.')
      && groupUiVerifier.includes('An invite with uncertain revocation must not remain copyable.')
      && groupUiVerifier.includes('Invite-revocation recovery must hide competing link creation while its modal is open.')
      && groupInviteManager.includes('Checking again can only revoke this same link; it cannot restore or replace it.')
      && groupUiVerifier.includes('An organizer must be able to prepare separate one-person links for a larger group.')
      && groupUiVerifier.includes('What joining shares')
      && groupUiVerifier.includes('Joining a four-person group must not manufacture or expose taste evidence.')
      && groupUiVerifier.includes('A new recipient must return from identity setup to the same invite without creating taste evidence.')
      && groupUiVerifier.includes('A revoked invite must reveal no group identity.')
      && groupInvitePage.includes("prototypeFailure('invite-read')")
      && groupInvitePage.includes("prototypeFailure('invite-profile')")
      && groupUiVerifier.includes('A failed invite lookup must reveal no group identity.')
      && groupUiVerifier.includes('A failed profile read must not be mistaken for a missing profile.')
      && groupInvitePage.includes("invite.status === 'accepted'")
      && v2Functions.includes("inviteData.status === 'accepted'")
      && groupUiVerifier.includes('An ambiguous acceptance response must not present the retry as a fresh Join.')
      && groupUiVerifier.includes('An already accepted recipient must never see a second Join action.')
      && read('scripts/check-v2-groups.mjs').includes('acceptance replay recovers the same member while other recipients remain denied')
      && groupUiVerifier.includes('Invite capacity must not fabricate another token.')
      && groupUiVerifier.includes('A consumed invite must disappear instead of leaving a stale shareable URL.')
      && groupPage.includes('group.projectionCount === 0')
      && groupUiVerifier.includes('INVITATIONS OPEN · 2 OF 6 PEOPLE')
      && groupUiVerifier.includes('SHARING CIRCLE · 2 PEOPLE')
      && groupRecommendationDomain.includes('sparseGroupRecovery')
      && groupRecommendationDomain.includes("kind: 'answerable_want'")
      && groupPage.includes('Answer with Quick start')
      && groupPage.includes("searchParams.get('welcome') === 'quick'")
      && groupPrototype.includes("prototypeState') === 'sparse-only'")
      && groupUiVerifier.includes('The useful category must never be preselected for the member.')
      && groupUiVerifier.includes('assert(resolvedCandidateCount === 1')
      && groupUiVerifier.includes('deliberate matching hint admits exactly one place; found ${resolvedCandidateCount}.')
      && groupUiVerifier.includes('The focused Quick start route must preserve the development fixture state across its remount.')
      && groupUiVerifier.includes('An empty Keep filter must not borrow places from another status.')
      && savedPage.includes("import { KeepGrid } from '../components/KeepGrid'")
      && savedPage.includes("prototypeFailure('keep-permission')")
      && savedPage.includes("prototypeFailure('keep-refresh')")
      && savedPage.includes('prototypeColdError || saves === undefined')
      && savedPage.includes('!coldLoadFailed && !savesQuery.isPending')
      && baseCss.includes('.keep-grid')
      && baseCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')
      && groupUiVerifier.includes('Keep cards must render row-major so visual and focus order agree')
      && groupUiVerifier.includes('A cold Keep permission failure must fail closed without personal place identities.')
      && groupUiVerifier.includes('Unavailable Keep data must never masquerade as an empty account.')
      && groupUiVerifier.includes('A warm Keep refresh failure must preserve every last-authorized personal place.')
      && groupUiVerifier.includes('Keep refresh recovery must scroll fully above the fixed primary dock.')
      && groupUiVerifier.includes('People must deduplicate all five other members across the fixture')
      && queriesData.includes('freshOnMount?: boolean')
      && queriesData.includes("refetchOnMount: freshOnMount ? 'always' : undefined")
      && queriesData.includes("refetchOnWindowFocus: freshOnMount ? 'always' : false")
      && togetherPage.includes('useGroups({ freshOnMount: true })')
      && togetherPage.includes('groupsQuery.error && groupsQuery.data === undefined')
      && togetherPage.includes("prototypeFailure('together-refresh')")
      && togetherPage.includes("prototypeFailure('together-legacy')")
      && togetherPage.includes("kind: 'groups' | 'legacy'")
      && groupUiVerifier.includes('A warm Together refresh failure must preserve every last-authorized group.')
      && groupUiVerifier.includes('A legacy-pair lookup failure must never block canonical groups.')
      && groupUiVerifier.includes('Canonical groups must remain visually primary above optional legacy recovery.')
      && peoplePage.includes('useGroups({ freshOnMount: true })')
      && groupDraftUiVerifier.includes('a primary directory remount revalidates membership without polling or a duplicate listener')
      && peoplePage.includes("groups.length > 0 && people.size === 0")
      && peoplePage.includes('Nothing from Keep is shared until you choose it.')
      && peoplePage.includes("prototypeFailure('people-permission')")
      && peoplePage.includes('groupsQuery.data === undefined')
      && groupUiVerifier.includes('A cold People permission failure must fail closed without member identities.')
      && groupUiVerifier.includes('A cold People permission failure must not leak cached group names.')
      && groupUiVerifier.includes('People retry must leave the development failure state and restore the authorized directory.')
      && groupUiVerifier.includes('A one-person forming group must not invent another member.')
      && groupUiVerifier.includes('People must route a one-person forming group to its truthful invitation boundary.')
      && groupUiVerifier.includes('The first-group invitation recovery must remain fully visible above the fixed dock at 390×844.')
      && groupUiVerifier.includes('A focused group decision must remove the persistent dock')
      && groupUiVerifier.includes('Keep recall must open the canonical personal memory directly.')
      && groupUiVerifier.includes('The capture lane must not advertise unavailable vibe discovery.')
      && groupUiVerifier.includes('Loved filter must contain only the explicitly changed place.')
      && groupUiVerifier.includes('Legacy circle visibility must not remain a selectable forward audience.')
      && groupUiVerifier.includes('Keep must render the confirmed personal label rather than the Google result label.')
      && groupUiVerifier.includes('Reopening a captured place must not resurrect the discarded Google label.')
      && groupUiVerifier.includes('A newly captured personal place must default to private.')
      && groupUiVerifier.includes('Group-native capture must not offer the retired all-connections audience.')
      && closeupPage.includes('useCatalog, useGroups, useMySaves, useSaveFlow')
      && !closeupPage.includes('FriendGraph')
      && !queriesData.includes('usePlaceSaves')
      && !socialData.includes('fetchPlaceSaves')
      && !componentsCss.includes('.friendgraph')
      && groupPrototype.includes("current => current ?? personalSaves")
      && groupUiVerifier.includes('Every prototype group projection owned by Mika must have one canonical personal Keep save.')
      && groupUiVerifier.includes('A personal Keep place must not render unscoped connection or cross-group evidence.')
      && groupUiVerifier.includes('A personal place route must not expose member identities without one named group audience.')
      && closeupPage.includes('Still shared outside groups')
      && closeupPage.includes('keeps any exact group shares below.')
      && closeupPage.includes('Make this place private')
      && closeupPage.includes("legacyVisibilityFailure ? 'Check privacy'")
      && closeupPage.includes('it cannot remove the place from Keep or any group.')
      && savesData.includes("if (current.data().visibility === visibility) return")
      && savesData.includes('if (unchanged) return')
      && savesData.includes("if (sameMemory(current.data().memory, memory)) return")
      && savesData.includes("if (current.data().note === trimmed && current.data().visibility === visibility) return")
      && savesData.includes("if (sameObservations(current.data().observations, observations)) return")
      && closeupPage.includes('Keep change not confirmed.')
      && closeupPage.includes('Keep removal not confirmed.')
      && closeupPage.includes('Place details not confirmed.')
      && closeupPage.includes('Note not confirmed.')
      && closeupPage.includes('Useful detail not confirmed.')
      && addPage.includes('It does not share with ${groupAudience.name} yet; that is the next separate step.')
      && groupUiVerifier.includes('Legacy privacy cleanup must precede exact-group sharing, which must precede optional note editing.')
      && groupUiVerifier.includes('The legacy privacy cleanup action must remain fully visible above the fixed dock at 390×844.')
      && groupUiVerifier.includes('Checking the exact privacy change must be a byte-stable no-op after the first commit.')
      && groupUiVerifier.includes('Checking the exact tag must preserve the first commit timestamp and stored bytes.')
      && groupUiVerifier.includes('Checking the exact note must be a byte-stable no-op after commit.')
      && groupUiVerifier.includes('Checking new Keep must preserve its first timestamp before the separate group share runs.')
      && closeupPage.includes('Stop sharing with ${group.name}')
      && closeupPage.includes("? `Shared · ${included.length > 0")
      && groupUiVerifier.includes('A shared audience must expose its actual removal action instead of a misleading state label.')
      && groupUiVerifier.includes('Sharing with one group must not silently select another group.')
      && groupUiVerifier.includes('Included note and useful-detail choices must remain independent for each named group.')
      && closeupPage.includes('groupShareOptions[group.id]')
      && closeupPage.includes('Include my current note with ${group.name}')
      && groupUiVerifier.includes('Removing group sharing must not remove the canonical personal note.')
      && groupUiVerifier.includes('Removing exact group sharing must remove only that group projection.')
      && groupsData.includes('const reads = await Promise.all(groupIds.map')
      && !groupsData.includes('Promise.allSettled(groupIds.map')
      && v2Functions.includes('const desiredProjection = groupSignalProjection(')
      && v2Functions.includes('if (unchanged && state.membershipLocked) return')
      && closeupPage.includes('Share status unknown')
      && closeupPage.includes("'Check included details'")
      && closeupPage.includes("'Check removal'")
      && closeupPage.includes('No group is being labeled shared or not shared. Nothing was changed.')
      && addPage.includes('Saved privately. Group sharing not confirmed.')
      && addPage.includes('Checking again can only repeat this exact share with the circle you reviewed.')
      && groupUiVerifier.includes('An unavailable group-share read must expose no fabricated per-group status.')
      && groupUiVerifier.includes('An ambiguous group share must not remain a fresh Share action.')
      && groupUiVerifier.includes('An ambiguous removal must not guess that sharing stopped.')
      && groupUiVerifier.includes('The exact Add sharing recovery action must remain fully visible above the fixed dock.')
      && read('scripts/check-v2-groups.mjs').includes('exact group sharing and already-completed removal replay without rewriting either document')
      && groupUiVerifier.includes('Leave confirmation must focus the safe Stay action first.')
      && groupUiVerifier.includes('A left group must disappear from the current person')
      && groupUiVerifier.includes('Leaving a group must not remove personal Keep history.')
      && groupUiVerifier.includes('An ambiguous leave response must not claim that membership is unchanged.')
      && groupPage.includes('leaveGroup(targetGroupId)')
      && groupPage.includes('Your personal Keep stays yours if you leave.')
      && groupPage.includes('confirm whether you left.')
      && groupPage.includes('cannot rejoin you or remove your personal Keep.')
      && groupUiVerifier.includes('consoleErrors.length === 0')],
  ['the approved six-member ceiling is rendered with an honest unknown denominator',
    groupPrototype.includes("displayName: 'Noa'")
      && groupPrototype.includes("{ uid: noa.uid, name: noa.displayName, saves: [] }")
      && groupPrototype.includes('members: [me, vivian, ari, dev, lena, noa]')
      && groupUiVerifier.includes('Together must render all six members of a full group')
      && groupUiVerifier.includes('A full group plan must expose all six real members as attendee controls.')
      && groupUiVerifier.includes('These 6 people’s shared taste · no location profile.')
      && groupUiVerifier.includes('Why for us: 5 of 6 want or love this.')
      && groupUiVerifier.includes('Removing the unknown member must visibly update their attendance state.')
      && groupUiVerifier.includes('Restoring the unknown member must restore the truthful six-person denominator.')
      && groupUiVerifier.includes('A max-group Pick must persist all six attendees and one private receipt boundary')
      && groupUiVerifier.includes('Together must recover a six-person current Pick without truncating its group identity.')
      && groupUiVerifier.includes('A six-person current Pick must replace a second mutable attendee draft.')
      && groupUiVerifier.includes("getByText('6 going', { exact: true })")
      && groupUiVerifier.includes("getByText('6 were on the plan', { exact: true })")
      && groupUiVerifier.includes('group-ui-six-person-plan-mobile.png')
      && groupUiVerifier.includes('group-ui-six-person-current-pick-mobile.png')],
  ['canonical shell routes have semantic headings and two-width interaction-safe coverage',
    [
      '/together', '/saved', '/people', '/search', '/add', '/settings', '/p/group-sunlight',
      '/onboarding', '/groups/new', '/gi/prototype-four-person', '/with/retired-person',
      '/terms', '/privacy',
    ].every(route => groupUiVerifier.includes(`{ path: '${route}'`))
      && groupUiVerifier.includes('must expose exactly one page-level h1')
      && groupUiVerifier.includes('has controls outside the viewport')
      && groupUiVerifier.includes('has controls that cannot scroll clear of the fixed dock')
      && groupUiVerifier.includes("verifyResponsiveShell(browser, { width: 320, height: 568 }")
      && groupUiVerifier.includes("verifyResponsiveShell(browser, { width: 768, height: 1024 }")
      && savedPage.includes('<h1 className="eyebrow">KEEP</h1>')
      && searchPage.includes("pathname: '/add'")
      && groupUiVerifier.includes('${route.path} must recover into ${route.redirect}.')
      && addPage.includes("groupAudience?.name.toUpperCase() ?? 'A GROUP'")
      && addPage.includes(": 'ADD A NEW PLACE'")
      && read('v2/src/pages/Settings.tsx').includes('<h1 className="eyebrow">SETTINGS</h1>')],
  ['place capture has one production-shaped entry instead of a fixture-only Search catalog',
    searchPage.includes('Search is an action inside Add, never a catalog/discovery destination.')
      && searchPage.includes("pathname: '/add'")
      && savedPage.includes('to="/add?mode=discover" className="pill pill-primary press">Discover</Link>')
      && savedPage.includes('to="/add" className="pill pill-ghost press">Add</Link>')
      && closeupPage.includes('to="/add" className="pill pill-primary press">Find the place again</Link>')
      && !read('v2/src/data/candidates.ts').includes('return seeded')
      && !componentsCss.includes('.search-capture')
      && !componentsCss.includes('.search-refinements')
      && groupUiVerifier.includes('Keep recall must open the canonical personal memory directly.')
      && groupUiVerifier.includes('${route.path} signed-out recovery must enter ${route.redirect}.')],
  ['personal discovery is explicit-area, locally taste-ordered, reviewed, and private by default',
    addPage.includes("searchParams.get('mode') === 'discover'")
      && addPage.includes('personalDiscoveryPrompts(personalSavesQuery.data ?? [])')
      && addPage.includes('personalDiscoveryMapsUrl(externalDiscoveryQuery)')
      && addPage.includes('Explore in Google Maps')
      && addPage.includes('NO PLACES API REQUEST')
      && addPage.includes('One Google search for ${query}. Choose a result to review it.')
      && addPage.includes('Private Keep only orders these prompts.')
      && addPage.includes('const displayedSuggestions = discoveryMode ? suggestions.slice(0, 3) : suggestions')
      && addPage.includes('Preview in Google Maps')
      && addPage.includes('href={mapsDeepLink(s.name, s.placeId)}')
      && addPage.includes("s.support === 'supported'")
      && groupDraftUiVerifier.includes('A Maps preview must not spend a Details request.')
      && groupDraftUiVerifier.includes('A Maps preview must not alter an existing private memory.')
      && groupDraftUiVerifier.includes('A Maps preview must not rewrite an existing private memory.')
      && groupDraftUiVerifier.includes('A Maps preview must not create an unprefixed private save.')
      && groupDraftUiVerifier.includes('A Maps preview must not share with a group.')
      && read('v2/src/domain/personalDiscovery.ts').includes("save.tag === 'tried'") === false
      && read('v2/src/domain/personalDiscovery.ts').includes("if (save.tag === 'loved')")
      && read('v2/src/domain/personalDiscovery.ts').includes("if (save.tag === 'want')")
      && read('v2/src/domain/personalDiscovery.ts').includes('export function personalDiscoveryMapsUrl')
      && json('v2/package.json').scripts?.['test:domain']?.includes('personalDiscovery.test.js') === true
      && zeroApiLinkVerifier.includes('zero-api-discovery-handoff-mobile.png')
      && groupUiVerifier.includes('async function verifyPersonalDiscovery')
      && groupUiVerifier.includes('Personal discovery must default the new place to private Keep.')
      && groupUiVerifier.includes('group-ui-personal-discovery-mobile.png')],
  ['production-mode discovery and private-save handoff prove cost-controlled persistence and one exact active audience',
    placesData.includes("const EMULATOR_PLACES_STUB = EMULATOR_BUILD")
      && placesData.includes("? '/__this_is_emulator_places/v1'")
      && placesData.includes('return new URL(`${API}${path}`, window.location.origin)')
      && placesData.includes("const CAPTURE_FIELD_MASK = 'id,formattedAddress,location,types'")
      && placesData.includes('normalizeCapturePlaceDetails(await res.json(), placeId, selectedName)')
      && placesData.includes('normalizePlaceDetails(await res.json(), placeId)')
      && read('v2/src/domain/googlePlaceDetails.ts').includes('if (!data || !id || data.id !== id) return null')
      && read('v2/src/domain/googlePlaceDetails.ts').includes("support: 'unsupported'")
      && read('v2/src/domain/googlePlaceDetails.ts').includes("reason: 'storage-contract'")
      && json('v2/package.json').scripts?.['test:domain']?.includes('googlePlaceDetails.test.js') === true
      && addPage.includes('privateOnly: true')
      && addPage.includes("reviewSharing: !groupId && confirmedTag !== 'tried'")
      && addPage.includes('privateCapture: !groupId')
      && queriesData.includes('reviewSharing: args.reviewSharing')
      && queriesData.includes('privateCapture: args.privateCapture')
      && saveToastHost.includes("const reviewSharing = Boolean((toast.privateCapture || toast.reviewSharing) && toast.tag !== 'tried')")
      && saveToastHost.includes("reviewSharing ? 'sharing' : 'note'")
      && saveToastHost.includes("reviewSharing ? 'Review sharing' : 'add a note'")
      && closeupPage.includes("const reviewGroupSharing = params.get('sharing') === '1'")
      && closeupPage.includes('ref={groupSharingSectionRef}')
      && closeupPage.includes('name: myMemory.label')
      && addPage.includes('useGroupAudience(groupId ?? undefined)')
      && !addPage.includes('useGroup(groupId ?? undefined)')
      && addPage.includes("const searchReady = session.status === 'signed-in'")
      && addPage.includes("&& (!groupId || groupAudience?.status === 'active')")
      && addPrivateSavesReadIsAudienceProtected
      && addPage.includes('if (!searchReady)')
      && queriesData.includes('/** One-document audience check for Add. It never loads group taste. */')
      && queriesData.includes("queryKey: ['groupAudience', groupId, uid]")
      && groupsData.includes('Taste projections and Quick start preferences stay unread.')
      && groupsData.includes("const snapshot = await getDoc(doc(db, 'groups', groupId))")
      && addPage.includes("groupAudience?.status === 'forming'")
      && addPage.includes("confirmedTag === 'tried'")
      && addPage.includes("action: 'remove'")
      && savesData.includes('privateOnly?: boolean')
      && savesData.includes("options.privateOnly\n      ? 'private'")
      && groupDraftUiVerifier.includes('const placesStubOrigin = `${origin}/__this_is_emulator_places/v1`')
      && groupDraftUiVerifier.includes("['input', 'languageCode', 'sessionToken']")
      && groupDraftUiVerifier.includes("'id,formattedAddress,location,types'")
      && groupDraftUiVerifier.includes('A category choice should issue exactly one autocomplete request.')
      && groupDraftUiVerifier.includes('The private canonical save must commit before explicit group sharing begins.')
      && groupDraftUiVerifier.includes('exact-link capture to commit privately before any group choice')
      && groupDraftUiVerifier.includes('Opening reviewed private memory must not spend a Place Details request.')
      && groupDraftUiVerifier.includes('Review sharing must not leak into another active group.')
      && groupDraftUiVerifier.includes('Review sharing must not leak into a forming group.')
      && groupDraftUiVerifier.includes('One shared place needs your honest answer.')
      && groupDraftUiVerifier.includes('private-save-review-sharing-mobile.png')
      && groupDraftUiVerifier.includes('PASS exact Maps identity stays private, offers Review sharing')
      && groupDraftUiVerifier.includes('A private capture must restore Review sharing after a Tried-to-Want retag.')
      && groupDraftUiVerifier.includes('The exact share must not leak into another active group.')
      && groupDraftUiVerifier.includes('The exact share must not leak into a forming group.')
      && groupDraftUiVerifier.includes("tag: 'tried', visibility: 'circle'")
      && groupDraftUiVerifier.includes('Tried to remain private and remove the named group projection')
      && groupDraftUiVerifier.includes('An empty provider response must never start a save or share operation.')
      && groupDraftUiVerifier.includes('A failed Details response must never start a save or share operation.')
      && groupDraftUiVerifier.includes("waitUntil('mismatched Details rejection'")
      && groupDraftUiVerifier.includes("`${owner.localId}__g:${mismatchedDetailsPlaceId}`")
      && groupDraftUiVerifier.includes('An unsupported provider identifier must never start Details, save, or share work.')
      && groupDraftUiVerifier.includes("'autocomplete-unsupported'")
      && groupDraftUiVerifier.includes('mismatched, or unsupported provider responses without Google quota')
      && groupDraftUiVerifier.includes('No discovery state may reach Google during emulator verification.')
      && groupDraftUiVerifier.includes('A prefilled URL must not search while its group audience is still forming.')
      && groupDraftUiVerifier.includes("getByRole('heading', { name: 'Finish the audience first.' })")
      && groupDraftUiVerifier.includes('group-discovery-review-action-emulator-mobile.png')
      && groupDraftUiVerifier.includes('PASS discovery persists privately, shares with one named group, retracts on Tried')
      && !v2Functions.includes('if (!before && after) return')
      && v2Functions.includes("firestore.collectionGroup('signals')")
      && v2Functions.includes(".where('uid', '==', uid)")
      && v2Functions.includes(".where('placeId', '==', placeId)")
      && v2Functions.includes('transaction.get(saveRef)')
      && v2Functions.includes('projection.updateTime, save.createTime')
      && projectionSync.includes('export function projectionBelongsToSaveLifetime(')
      && read('scripts/check-v2-groups.mjs').includes('A delayed delete must not remove a current re-shared projection.')
      && read('scripts/check-v2-groups.mjs').includes('runProjectionSyncEvent(lifetimeSaveId, null, {')
      && read('scripts/check-v2-groups.mjs').includes("A recreated private save must not inherit an older document lifetime\\'s group consent.")
      && read('scripts/check-v2-groups.mjs').includes('stale save events use current canonical truth, preserve current re-sharing, and cannot transfer old consent across recreation')
      && v2Indexes.indexes?.some(item => item.collectionGroup === 'signals'
        && item.queryScope === 'COLLECTION_GROUP'
        && item.fields?.some(field => field.fieldPath === 'uid' && field.order === 'ASCENDING')
        && item.fields?.some(field => field.fieldPath === 'placeId' && field.order === 'ASCENDING'))
      && v2Functions.includes('!validDocumentId(groupId, 160) || !validDocumentId(placeId, 260)')
      && v2Functions.includes("response.status(422).json({ error: 'invalid-share-target' })")
      && v2Functions.includes("response.status(422).json({ error: 'invalid-share-action' })")
      && v2Functions.includes("requestedAction === undefined || requestedAction === 'save'")
      && v2Functions.includes("response.status(422).json({ error: 'invalid-quick-start-action' })")
      && v2Functions.includes("response.status(422).json({ error: 'invalid-quick-start-target' })")
      && read('scripts/check-v2-groups.mjs').includes("placeId: 'g:nested/place'")
      && read('scripts/check-v2-groups.mjs').includes("malformedSharePlace.payload.error, 'invalid-share-target'")
      && read('scripts/check-v2-groups.mjs').includes("action: 'publish'")
      && read('scripts/check-v2-groups.mjs').includes("malformedShareAction.payload.error, 'invalid-share-action'")
      && read('scripts/check-v2-groups.mjs').includes('await shareReplayRef.get()).exists, false')
      && read('scripts/check-v2-groups.mjs').includes("action: 'remvoe'")
      && read('scripts/check-v2-groups.mjs').includes("malformedQuickStartAction.payload.error, 'invalid-quick-start-action'")
      && read('scripts/check-v2-groups.mjs').includes("malformedQuickStartTarget.payload.error, 'invalid-quick-start-target'")
      && read('scripts/check-v2-groups.mjs').includes("data()?.membershipLocked, false")
      && read('scripts/check-v2-groups.mjs').includes("data()?.status, 'active'")],
  ['signed-out shell protects private group identity and authenticates before group creation',
    [
      '/together', '/saved', '/people', '/search', '/add', '/settings', '/onboarding',
      '/groups/new', '/g/prototype-evidence-lab', '/gi/prototype-four-person',
      '/with/retired-person', '/terms', '/privacy',
    ].every(route => groupUiVerifier.includes(`{ path: '${route}'`))
      && groupUiVerifier.includes('signed-out state must expose exactly one page-level h1')
      && groupUiVerifier.includes('must not show private app navigation before sign-in')
      && groupUiVerifier.includes('Signed-out private group must not reveal')
      && groupUiVerifier.includes('Signed-out group creation must not expose a form that can only fail.')
      && groupUiVerifier.includes("verifySignedOutResponsiveShell(browser, { width: 320, height: 568 }")
      && groupUiVerifier.includes("verifySignedOutResponsiveShell(browser, { width: 768, height: 1024 }")
      && groupPage.includes("session.status === 'signed-out'")
      && groupPage.includes('Sign in to open your group.')
      && groupPage.includes('Group names, members, and shared taste stay hidden')
      && groupPage.includes('onClick={() => void signIn()}')
      && createGroupPage.includes("session.status === 'signed-out'")
      && createGroupPage.includes('Sign in before you create a group.')
      && createGroupPage.includes('Signing in does not share anything from Keep.')
      && createGroupPage.includes('onClick={() => void signIn()}')],
  ['Together prominence follows a real current Pick, never array position',
    togetherPage.includes("Number(Boolean(b.group.activePick))")
      && togetherPage.includes("group.activePick ? ' has-current-pick'")
      && !togetherPage.includes("index === 0 ? ' is-amber'")
      && componentsCss.includes('.group-index-card:not(.has-current-pick) .group-index-copy .t-display')
      && componentsCss.includes('.group-index-card.has-current-pick {\n  min-height: 214px;')
      && groupUiVerifier.includes('Together must not visually feature an ordinary first group by array position.')
      && groupUiVerifier.includes('Three complete ordinary groups must remain visible above the fixed dock at 390×844.')
      && groupUiVerifier.includes('A group with a current Pick must move ahead of ordinary groups as a recovery task.')
      && groupUiVerifier.includes('A real current Pick must retain materially stronger recovery prominence than ordinary groups.')],
  ['Together summaries use authoritative state and projection counts',
    togetherPage.includes('function groupIndexSummary(group: GroupIndexItem)')
      && togetherPage.includes('group.projectionCount === 0')
      && togetherPage.includes("`${group.projectionCount} shared place ${group.projectionCount === 1 ? 'signal' : 'signals'}`")
      && togetherPage.includes('what its explicitly shared taste can answer now')
      && !togetherPage.includes('group.changeLabel')
      && !togetherPage.includes('Your recurring groups already have taste history.')
      && groupUiVerifier.includes('12 shared place signals')
      && groupUiVerifier.includes('No shared place signals yet')],
  ['Keep renders canonical personal memory without a compatibility place snapshot',
    savedPage.includes('all.filter(save => save.memory)')
      && savedPage.includes('const memory = save.memory')
      && savedPage.includes('memory.area')
      && savedPage.includes('to={`/p/${encodeURIComponent(save.placeId)}`}')
      && !savedPage.includes('all.filter(save => save.memory && save.place)')
      && groupUiVerifier.includes('Keep cards must be real links to the canonical memory route.')],
  ['Zero-candidate groups lead with truthful recovery, not a shortlist promise',
    groupPage.includes("group.status === 'active' && candidates.length === 0 ? null")
      && groupPage.includes('const waitingForIndependentReason = group.projectionCount > 0 && eligibleBeforePlan.length === 0')
      && groupPage.includes('Shared places need another reason.')
      && groupPage.includes("eligibleBeforePlan.length > 0 && attendeeUids.length >= 2")
      && groupPage.includes('sparseGroupRecovery({')
      && groupPage.includes('Review my Want')
      && groupPage.includes('Show Anything')
      && groupUiVerifier.includes('A zero-candidate group must not lead with a shortlist promise it cannot currently support.')
      && groupUiVerifier.includes('A group with zero shared places must not show planning controls that cannot change its empty answer.')
      && groupUiVerifier.includes('Zero history must offer one optional hint-edit action, not duplicate it around unusable controls.')
      && groupUiVerifier.includes('One explicit group-added Want must wait for independent support.')
      && groupUiVerifier.includes('Planning controls must stay hidden when no current setting can make a lone Want eligible.')
      && groupUiVerifier.includes('A person must not be offered their own Quick start as corroboration for their own lone Want.')
      && groupUiVerifier.includes('Show Anything must restore the eligible unfiltered shortlist.')
      && groupUiVerifier.includes('Planning controls must return only after at least one place has an eligible reason.')
      && groupUiVerifier.includes('The primary zero-candidate remedy must be visible in the initial 390×844 viewport.')],
  ['Group shortlist promise reports the exact visible one-to-three count',
    groupPage.includes('candidates.length === 1')
      && groupPage.includes('<>One place.<br />A real reason.</>')
      && groupPage.includes('candidates.length === 2')
      && groupPage.includes('<>Two places.<br />Real reasons.</>')
      && groupPage.includes('<>Three places.<br />Real reasons.</>')
      && groupUiVerifier.includes("name: 'One place. A real reason.'")
      && groupUiVerifier.includes("name: 'Two places. Real reasons.'")
      && groupUiVerifier.includes('A current draft with no visible candidates must not keep a stale shortlist-count hero.')],
  ['signed-out acquisition and onboarding describe the truthful group product',
    togetherPage.includes('Invite the two to six people you actually')
      && togetherPage.includes('Ari can introduce the group.')
      && togetherPage.includes('The other three stay unknown until they weigh in.')
      && !togetherPage.includes('The group chat already has the answer.')
      && !togetherPage.includes('3 places already make sense.')
      && onboardingPage.includes("groupInviteToken ? 'Continue to invite' : 'Next'")
      && onboardingPage.includes('onboarding stops after identity and returns to consent')
      && !onboardingPage.includes('BEFORE YOU JOIN')
      && onboardingPage.includes('Keep one place you already love.')
      && !onboardingPage.includes("'none yet'")
      && onboardingPage.includes('later you can add a place from search, a recommendation, or your phone’s share sheet.')
      && dockComponent.includes("session.status !== 'signed-in'")
      && groupUiVerifier.includes('Primary app navigation must not cover or advertise signed-in destinations on acquisition.')
      && groupUiVerifier.includes('The complete signed-out evidence card must remain visible at the mobile decision height.')
      && groupUiVerifier.includes('Invite onboarding must not ask for a private place immediately before the group asks for an optional contribution.')
      && groupUiVerifier.includes('Invite identity setup must return to consent from the initial 390×844 viewport.')],
  ['the installed app receives one shared place through the reviewed Add flow',
    webManifest.share_target?.action === '/add'
      && webManifest.share_target?.method === 'GET'
      && webManifest.share_target?.params?.title === 'title'
      && webManifest.share_target?.params?.text === 'text'
      && webManifest.share_target?.params?.url === 'url'
      && mapsUrlDomain.includes('export function sharedPlaceInput')
      && addPage.includes('Shared here from another app. Review it before adding.')
      && addPage.includes('window.history.replaceState')
      && groupUiVerifier.includes('Receiving a shared place must not resolve it or spend Places quota before review.')],
  ['explicit Google capture teaches the review boundary before any request',
    addPage.includes('ONE PLACE · REVIEW FIRST')
      && addPage.includes('Google search waits for three letters.')
      && addPage.includes('Choosing a result opens a review—it does not save the place yet.')
      && addPage.includes('before the place reaches Keep.')
      && onboardingPage.includes('className="gmp-attribution" translate="no">Google Maps</p>')
      && groupUiVerifier.includes('Onboarding Google autocomplete must carry adjacent Google Maps attribution.')
      && groupUiVerifier.includes('Opening empty Google capture must not spend Places quota or resolve a link.')
      && groupUiVerifier.includes('The complete capture review boundary must remain visible above the fixed dock at 390×844.')],
  ['ordinary capture records Want, Tried, or Loved before persistence',
    placeMemoryConfirmation.includes('aria-label="Keep this place as"')
      && placeMemoryConfirmation.includes("tag: 'tried', label: 'Tried', detail: 'I have been'")
      && placeMemoryConfirmation.includes('this alone does not support choosing it.')
      && addPage.includes('useState<Tag | null>(null)')
      && addPage.includes('onSignalTagChange={chooseCaptureTag}')
      && addPage.includes('if (!captureTag || (activePracticalNeed && !practicalNeedAnswer)) return')
      && addPage.includes('tag: confirmedTag')
      && addPage.includes('Keep & share as ${TAG_LABELS[captureTag]}')
      && placeMemoryConfirmation.includes('disabled={!confirmationReady || busy || locked}')
      && placeMemoryConfirmation.includes('disabled={busy || locked}')
      && addPage.includes("'OPENING…' : 'REVIEW'")
      && onboardingPage.includes("'OPENING…' : 'REVIEW'")
      && onboardingPage.includes('privateOnly: true')
      && groupUiVerifier.includes('Onboarding capture must override a colliding legacy connection-visible save to private.')
      && groupUiVerifier.includes('Onboarding unsupported provider identifiers must stop before Details or writes.')
      && groupUiVerifier.includes('Ordinary capture must begin without fabricating Want, Tried, or Loved.')
      && placeMemoryConfirmation.includes('OPTIONAL PLACE DETAIL')
      && placeMemoryConfirmation.includes('{signalRequired && areaField}')
      && groupUiVerifier.includes('Optional area must not lead new place capture ahead of truthful experience.')
      && groupUiVerifier.includes('Ordinary capture must persist the explicitly chosen Loved experience.')
      && groupUiVerifier.includes('The chosen experience action must scroll fully above the fixed dock at 390×844.')
      && groupUiVerifier.includes('Group-scoped capture must persist the experience the person explicitly returned to.')],
  ['group-scoped capture names one authorized audience and fails closed without it',
    addPage.includes('const groupQuery = useGroupAudience(groupId ?? undefined)')
      && addPage.includes('shareAudience={groupAudience?.name}')
      && addPage.includes("prototypeFailure('add-group-read')")
      && addPage.includes('prototypeGroupReadError || groupQuery.data === undefined')
      && addPage.includes('We couldn’t check this group.')
      && addPage.includes('That group isn’t available.')
      && placeMemoryConfirmation.includes('aria-label="Group sharing boundary"')
      && placeMemoryConfirmation.includes('Only this group receives the place. Your personal Keep remains yours.')
      && groupUiVerifier.includes('Group capture must name only its exact authorized audience.')
      && groupUiVerifier.includes('The exact group audience must precede optional geography in capture reading order.')
      && groupUiVerifier.includes('Cancelling group capture must leave no personal save or shareable group evidence.')
      && groupUiVerifier.includes('An unresolved group audience must fail closed before memory confirmation.')
      && groupUiVerifier.includes('An unresolved group audience must not create a private save as a hidden fallback.')
      && groupUiVerifier.includes('A failed Add audience lookup must reveal no cached group name.')
      && groupUiVerifier.includes('A failed Add audience lookup must not mount provider capture.')
      && groupUiVerifier.includes('Add audience retry must restore the exact authorized group before capture.')
      && groupUiVerifier.includes('The exact-audience sharing action must scroll fully above the fixed dock at 390×844.')],
  ['bare Tried capture stays private until the person supplies group support',
    addPage.includes("confirmedTag === 'tried'")
      && addPage.includes('Keep privately as Tried')
      && addPage.includes('Choose Want or Loved to introduce it to ${groupAudience?.name}.')
      && placeMemoryConfirmation.includes("shareIntent === 'private' ? 'KEEP PRIVATE' : 'CHOOSE FIRST'")
      && placeMemoryConfirmation.includes('Nothing shared with ${shareAudience} yet')
      && placeMemoryConfirmation.includes('it is not a reason to choose this place.')
      && groupUiVerifier.includes('Group capture must wait for explicit place-kind and experience choices before sharing.')
      && groupUiVerifier.includes('Bare Tried capture from a group must persist only truthful private history.')
      && groupUiVerifier.includes('Bare Tried capture must not silently create the named group projection.')
      && groupUiVerifier.includes('A private Tried memory must not manufacture a group candidate.')],
  ['default lint command targets canonical source only', rootPackage.scripts?.lint === 'eslint v2/src v2-functions/src'],
  ['every legacy-only root command is explicitly namespaced v1', legacyOnlyCommands.every(name =>
    rootPackage.scripts?.[name] === undefined && typeof rootPackage.scripts?.[`${name}:v1`] === 'string')],
  ['Firebase CLI has no implicit default project and names only the legacy project alias',
    !Object.hasOwn(firebaseProjectAliases, 'default')
      && firebaseProjectAliases.legacy === 'this-is-76332'
      && Object.keys(firebaseProjectAliases).length === 1],
  ['every Firebase deployment entrypoint explicitly targets the legacy project and the intended config',
    firebaseDeployCommands.length === 4
      && firebaseDeployCommands.every(([, command]) => command.includes('--project this-is-76332'))
      && rootPackage.scripts?.['firebase:deploy'] === 'npm run cutover:check && npm run build && firebase deploy --project this-is-76332 --config firebase.v2.json'
      && rootPackage.scripts?.['firebase:deploy:v1'] === 'npm run build:v1 && firebase deploy --project this-is-76332 --config firebase.json'
      && rootPackage.scripts?.['db:deploy-rules:v1'] === 'firebase deploy --project this-is-76332 --config firebase.json --only firestore:rules'
      && rootPackage.scripts?.['db:deploy-indexes:v1'] === 'firebase deploy --project this-is-76332 --config firebase.json --only firestore:indexes'],
  ['v2 hosting target serves v2/dist', hosting.hosting?.public === 'v2/dist'],
  ['v2 deploy target installs the locked v2 rules', hosting.firestore?.rules === 'v2/firestore.rules'],
  ['v2 deploy target uses the canonical index manifest', hosting.firestore?.indexes === 'v2/firestore.indexes.json'],
  ['projection sync declares its composite index and orders production rollout behind READY evidence',
    v2Indexes.indexes?.some(item => item.collectionGroup === 'signals'
      && item.queryScope === 'COLLECTION_GROUP'
      && item.fields?.some(field => field.fieldPath === 'uid' && field.order === 'ASCENDING')
      && item.fields?.some(field => field.fieldPath === 'placeId' && field.order === 'ASCENDING'))
      && v2Functions.includes("firestore.collectionGroup('signals')")
      && v2Functions.includes(".where('uid', '==', uid)")
      && v2Functions.includes(".where('placeId', '==', placeId)")
      && projectionSync.includes("if (isDeepStrictEqual(projection, desired)) return { action: 'none' }")
      && read('v2-functions/src/projection-sync.test.ts').includes('an already-current projection is a semantic no-op')
      && read('scripts/check-v2-groups.mjs').includes('A duplicate or stale event must not rewrite current projection or group metadata.')
      && cutoverContract.includes('deploy this index before the projection-sync Functions rollout')
      && cutoverContract.includes('they do not prove that the production index exists')
      && cutoverContract.includes('until Firestore reports it **READY**')],
  ['raw product events have a 30-day TTL deployment policy', v2Indexes.fieldOverrides?.some(item =>
    item.collectionGroup === 'events' && item.fieldPath === 'expiresAt' && item.ttl === true
      && Array.isArray(item.indexes) && item.indexes.length === 0)],
  ['an opened group decision records bounded candidate density once',
    groupPage.includes("track('plan_viewed', { context, candidateCount: allCandidates.length })")
      && groupPage.includes('trackedPlanGroupRef.current === group.id')
      && analyticsData.includes("| 'plan_viewed'")
      && analyticsData.includes('candidateCount?: number')],
  ['expired group invitation records have a seven-day TTL deletion policy', v2Indexes.fieldOverrides?.some(item =>
    item.collectionGroup === 'groupInvites' && item.fieldPath === 'expiresAt' && item.ttl === true
      && Array.isArray(item.indexes) && item.indexes.length === 0)
      && privacyPage.includes('scheduled for deletion through Firebase TTL after expiry')],
  ['shared group-draft passes have a six-hour TTL deletion policy', v2Indexes.fieldOverrides?.some(item =>
    item.collectionGroup === 'draftPasses' && item.fieldPath === 'expiresAt' && item.ttl === true
      && Array.isArray(item.indexes) && item.indexes.length === 0)],
  ['account deletion completion tombstones have a seven-day TTL deletion policy', v2Indexes.fieldOverrides?.some(item =>
    item.collectionGroup === 'accountDeletionOps' && item.fieldPath === 'expiresAt' && item.ttl === true
      && Array.isArray(item.indexes) && item.indexes.length === 0)],
  ['v2 uses a dedicated minimal Functions codebase', hosting.functions?.length === 1 && hosting.functions[0]?.source === 'v2-functions'],
  ['canonical Function rewrites are limited to Maps, explicit-area resolution, group lifecycle/drafts, public Pick receipts, and owner data rights', (() => {
    const ids = hosting.hosting?.rewrites?.flatMap(item => item.function?.functionId ? [item.function.functionId] : []) ?? []
    return JSON.stringify(ids.sort()) === JSON.stringify([
      'acceptGroupInvite', 'closeGroupPick', 'createGroup', 'createGroupInvite',
      'createGroupPick', 'deleteMyAccount', 'exportMyData', 'leaveGroup', 'listGroupInvites',
      'migratePairToGroup', 'pickReceipt', 'placePhoto', 'resolveMapsUrl', 'revokeGroupInvite', 'revokePickReceipt', 'saveGroupQuickStart', 'searchPlanAreas', 'shareGroupSignal', 'updateGroupDraftPass',
    ])
  })()],
  ['root README declares v2 canonical', readme.includes('Canonical product') && readme.includes('`v2/`')],
  ['future-agent guidance declares v2 canonical and root v1 frozen', agentGuide.includes('`v2/` — canonical') && agentGuide.includes('frozen v1')],
  ['v2 rules contain no prototype backdoor', !/function\s+isDevMode|2030/.test(executableRules(v2Rules))],
  ['a caller may preflight only their own deterministic missing save before idempotent create',
    v2Rules.includes("return signedIn() && saveId.matches('^' + request.auth.uid + '__.+$');")
      && v2Rules.includes('&& ((resource == null && callerSaveId(saveId))')
      && firestoreRulesTest.includes('an owner can read their own missing save before an idempotent create')
      && firestoreRulesTest.includes('a person cannot probe another owner’s missing save id')],
  ['a member may check only their own missing group projection before explicit sharing',
    v2Rules.includes("return signedIn() && signalId.matches('^' + request.auth.uid + '__.+$');")
      && v2Rules.includes('resource == null && callerGroupSignalId(signalId)')
      && firestoreRulesTest.includes('a member can check their own missing group projection before explicit sharing')
      && firestoreRulesTest.includes('a member cannot probe another member\\u2019s missing group projection id')],
  ['opaque group invitations allow exact-token preview but deny collection enumeration',
    /match \/groupInvites\/\{token\}[\s\S]*?allow get:[\s\S]*?allow list: if false;/.test(executableRules(v2Rules))
      && read('v2/tests/firestore-rules.mjs').includes('opaque group invites cannot be enumerated')],
  ['legacy provider place facts are client-inaccessible', /match \/places\/\{placeId\}[\s\S]*?allow read, write: if false;/.test(executableRules(v2Rules))],
  ['Google-derived catalog seeders fail closed and city pools are denied',
    candidateSeed.includes('Retired: Google Places results must not be seeded')
      && curatedSeed.includes('Retired: Google Places results must not be seeded')
      && /match \/cities\/[\s\S]*?allow read, write: if false;/.test(executableRules(v2Rules))
      && !/fetchCandidates|collection\(db, ['"]cities['"]\)/.test(candidatesData)],
  ['device location is absent from canonical search and onboarding',
    !/geolocation|locationBias|cachedCoords|homeCity/.test(appRoutes + placesData + read('v2/src/pages/Onboarding.tsx'))],
  ['temporary plan geography uses only explicit text and user-confirmed place areas',
    planAreaDomain.includes('EXPLICIT_PLAN_AREA_MAX_LENGTH = 80')
      && planAreaDomain.includes("match(/[\\p{L}\\p{N}]+/gu)")
      && planAreaDomain.includes('place geography is unknown')
      && groupRecommendationDomain.includes('matchesExplicitPlanArea(evidence.save.memory?.area, explicitPlanArea)')
      && groupPage.includes('Used for this draft only; never saved to a person or group.')
      && groupPage.includes('missing area stays unknown. No location profile.')
      && json('v2/package.json').scripts?.['test:domain']?.includes('planArea.test.js') === true
      && groupUiVerifier.includes('A mismatched explicit plan area must not leak a candidate from another city.')
      && groupUiVerifier.includes('Clearing temporary geography must immediately restore the unfiltered draft.')
      && !v2Functions.includes('explicitPlanArea')],
  ['future unfamiliar-area resolution is pinned, explicit-selection-only, and globally unbiased',
    planAreaGazetteerDomain.includes("provider: 'geonames'")
      && planAreaGazetteerDomain.includes('snapshotDate')
      && planAreaGazetteerDomain.includes('sourceDigest')
      && planAreaGazetteerDomain.includes('terms.every(term => context.includes(term))')
      && planAreaGazetteerDomain.includes("provenance: 'explicit_plan'")
      && planAreaGazetteerDomain.includes('const AREA_RADIUS_KM = 12')
      && planAreaGazetteerDomain.includes("latValue === '' || lngValue === ''")
      && json('v2/package.json').scripts?.['test:domain']?.includes('planAreaGazetteer.test.js') === true
      && !/(fetch\(|firebase|localStorage|sessionStorage|navigator\.geolocation|userId|groupId)/.test(planAreaGazetteerDomain)],
  ['area-gazetteer release planning is strict, identity-free, and read-only',
    rootPackage.scripts?.['gazetteer:plan'] === 'node scripts/plan-area-gazetteer.mjs'
      && rootPackage.scripts?.test?.includes('area-gazetteer-manifest-core.test.mjs') === true
      && areaGazetteerManifestCore.includes('sourceFiles must contain exactly cities500, admin1, and admin2')
      && areaGazetteerManifestCore.includes('persistsCoordinatesToPersonGroupSignalEventOrPick must be false')
      && areaGazetteerManifestCore.includes('serverSearchEnabled must remain false')
      && areaGazetteerManifestCore.includes('acceptedAreas + rejectedRows must equal rawCityRows')
      && !/(writeFile|appendFile|rmSync|unlinkSync|fetch\(|execFile|spawn\(|firebase-admin)/.test(areaGazetteerPlanner)],
  ['area-gazetteer indexing policy is deterministic, reconciled, and incapable of acquisition',
    planAreaGazetteerIndexDomain.includes("Exclude<GeoNamesPlanAreaRejection, 'invalid_provenance'>")
      && planAreaGazetteerIndexDomain.includes("'duplicate_identity'")
      && planAreaGazetteerIndexDomain.includes('rejectionTotal !== rejectedRows')
      && planAreaGazetteerIndexDomain.includes('indexBytes > input.limits.maxIndexBytes')
      && planAreaGazetteerIndexDomain.includes('sort(stableCompare)')
      && json('v2/package.json').scripts?.['test:domain']?.includes('planAreaGazetteerIndex.test.js') === true
      && areaGazetteerManifestCore.includes("'duplicate_identity'")
      && !/(fetch\(|firebase|writeFile|appendFile|localStorage|sessionStorage|navigator\.geolocation)/.test(planAreaGazetteerIndexDomain)],
  ['explicit-area server search is authenticated, digest-pinned, globally unbiased, and fail-closed',
    /export const searchPlanAreas/.test(v2Functions)
      && v2Functions.includes("collection('serviceConfig').doc('areaGazetteer')")
      && v2Functions.includes("response.status(503).json({ error: 'area-search-unavailable' })")
      && v2Functions.includes("kind: 'area_gazetteer_search'")
      && v2Functions.includes('!state.memberUids.includes(identity.uid)')
      && areaGazetteerService.includes("createHash('sha256')")
      && areaGazetteerService.includes('MAX_AREAS = 200_000')
      && areaGazetteerService.includes('MAX_RESULTS = 5')
      && areaGazetteerService.includes('device, IP, prior plans, group identity, and launch markets never enter')
      && rootPackage.scripts?.['verify:groups']?.includes('check-v2-groups.mjs') === true
      && read('scripts/check-v2-groups.mjs').includes('disabled without a reviewed artifact')],
  ['temporary practical needs use only attributed group-shared observations and fail closed',
    groupRecommendationDomain.includes('satisfiesRequiredObservation')
      && groupRecommendationDomain.includes("observation.value === 'no'")
      && groupRecommendationDomain.includes('confirmedYes = true')
      && groupRecommendationDomain.includes('sharedObservationsFor(evidence, requiredObservation)')
      && groupPage.includes('A group-shared Yes must exist and any No fails closed; missing stays unknown.')
      && groupPage.includes('Used only for this draft.')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('a requirement with one attributed yes and no conflicting no qualifies and remains visible first')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('an explicit no makes a practical requirement fail closed instead of averaging disagreement')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('missing useful-detail evidence never satisfies a plan requirement')
      && groupUiVerifier.includes('A group-shared No must fail a temporary practical requirement closed.')
      && groupUiVerifier.includes('A qualifying temporary need must remain visibly selected.')
      && groupPick.includes('satisfiesRequiredObservation(currentPlaceSignals, input.requiredObservation)')
      && groupPick.includes('matchesPlanArea(support[0].memory.area, planArea)')
      && v2Functions.includes("...(planArea ? { planArea } : {})")
      && v2Functions.includes("...(requiredObservation ? { requiredObservation } : {})")
      && pickContextChips.includes('PLACE_OBSERVATION_LABELS[requiredObservation]')
      && closeupPage.includes("contextLabel: 'Saved plan context'")
      && closeupPage.includes('label={pickPresentation.contextLabel}')
      && groupUiVerifier.includes('The temporary decision context must survive navigation as bounded Pick context.')
      && read('scripts/check-v2-groups.mjs').includes('public receipt omits it and other private evidence')],
  ['live Google photos carry a photo-specific Google Maps source link',
    placePhoto.includes('photos.googleMapsUri')
      && groupPhotosData.includes("decodedHeader(response, 'X-Photo-Source')")
      && pinVisual.includes('attributionUri')
      && pinVisual.includes('open source in Google Maps')],
  ['budgeted place photos have an authenticated server boundary and fail-closed allowance',
    /export const placePhoto/.test(v2Functions)
      && v2Functions.includes("defineSecret('PLACES_SERVER_KEY')")
      && v2Functions.includes("collection('serviceConfig').doc('placePhotos')")
      && v2Functions.includes("collection('serviceUsage').doc(`placePhotos-${month}`)")
      && placePhoto.includes('MAX_MONTHLY_PHOTOS = 999')
      && placePhoto.includes("'X-Goog-FieldMask': 'photos.name,photos.authorAttributions,photos.googleMapsUri'")
      && groupPhotosData.includes("VITE_GROUP_PHOTOS_ENABLED === 'true'")
      && groupPhotosData.includes("fetch('/placePhoto'")
      && groupPhotoHook.includes('takePhotoSlot(placeId)')
      && read('v2/src/lib/usePlacePhoto.ts').includes('fetchSavedPlacePhoto(placeId')
      && v2Functions.includes("collection('saves').doc(`${identity.uid}__${placeId}`)")
      && v2Functions.includes('validUserPlaceMemory(data?.memory, placeId)')
      && !placesData.includes('VITE_PLACES_PHOTOS_ENABLED')
      && !placesData.includes('/media`')
      && groupCandidateCard.includes('IntersectionObserver')
      && read('scripts/check-v2-groups.mjs').includes('remote photo kill switch denies media without reserving project allowance')
      && json('v2-functions/package.json').scripts?.test?.includes('place-photo.test.js') === true],
  ['owned/open catalog boundary is provenance-carrying and domain-tested',
    openCatalogDomain.includes("provider: 'overture'")
      && openCatalogDomain.includes('licenseLedgerId')
      && openCatalogDomain.includes('releaseId')
      && openCatalogDomain.includes('schemaVersion')
      && openCatalogDomain.includes('sourceAttributions')
      && openCatalogDomain.includes('record.license')
      && openCatalogDomain.includes('raw.taxonomy?.alternates')
      && openCatalogDomain.includes('operating_status')
      && openCatalogDomain.includes('googlePlaceId')
      && !openCatalogDomain.includes('displayName')
      && json('v2/package.json').scripts?.['test:domain']?.includes('openCatalog.test.js') === true],
  ['open-catalog extraction policy is bounded, reconciled, and incapable of acquisition',
    openCatalogExtractionDomain.includes("| 'duplicate_identity'")
      && openCatalogExtractionDomain.includes("| 'ineligible_status'")
      && openCatalogExtractionDomain.includes("reject('outside_bbox')")
      && openCatalogExtractionDomain.includes('rejectionTotal !== rejectedRows')
      && openCatalogDomain.includes("return { rejection: 'invalid_provenance' }")
      && json('v2/package.json').scripts?.['test:domain']?.includes('openCatalogExtraction.test.js') === true
      && openCatalogManifestCore.includes("'ineligible_status'")
      && openCatalogManifestCore.includes("'duplicate_identity'")
      && !/(fetch\(|firebase|writeFile|appendFile|localStorage|sessionStorage)/.test(openCatalogExtractionDomain)],
  ['open-catalog extraction serializes deterministically into the exact inactive server contract',
    openCatalogArtifactDomain.includes('buildOpenCatalogArtifact')
      && openCatalogArtifactDomain.includes('serializeOpenCatalogArtifact')
      && openCatalogArtifactDomain.includes('matchingProvenance')
      && openCatalogArtifactDomain.includes('accepted-row count does not reconcile')
      && json('v2/package.json').scripts?.['test:domain']?.includes('openCatalogArtifact.test.js') === true
      && rootPackage.scripts?.test?.includes('open-catalog-artifact-parity.test.mjs') === true
      && !/(fetch\(|firebase|writeFile|appendFile|localStorage|sessionStorage|createHash)/.test(openCatalogArtifactDomain)],
  ['open-catalog release planning is strict, identity-free, and read-only',
    rootPackage.scripts?.['catalog:plan'] === 'node scripts/plan-open-catalog.mjs'
      && rootPackage.scripts?.test?.includes('open-catalog-manifest-core.test.mjs') === true
      && openCatalogManifestCore.includes("releaseId must pin YYYY-MM-DD.N; latest is forbidden")
      && openCatalogManifestCore.includes('persistAreaToPersonOrGroup must be false')
      && openCatalogManifestCore.includes('appServingEnabled must remain false')
      && openCatalogManifestCore.includes('acceptedRows + rejectedRows must equal rawRows')
      && !/(writeFile|appendFile|rmSync|unlinkSync|fetch\(|execFile|spawn\(|firebase-admin)/.test(openCatalogPlanner)],
  ['open-catalog acquisition is explicit, release/bbox/row/byte bounded, license-preserving, and cannot activate',
    rootPackage.scripts?.['catalog:extract'] === 'npm --prefix v2 run build:domain-tools && node scripts/extract-open-catalog.mjs'
      && json('v2/package.json').scripts?.['build:domain-tools'] === 'tsc -p tsconfig.domain-test.json'
      && rootPackage.scripts?.test?.includes('open-catalog-acquisition-core.test.mjs') === true
      && openCatalogAcquisitionCore.includes('manifest.limits.maxRawRows + 1')
      && openCatalogAcquisitionCore.includes("shell: false")
      && openCatalogAcquisitionCore.includes('DuckDB 1.1.0 or newer is required')
      && openCatalogAcquisitionCore.includes('Raw row ceiling exceeded; use a smaller explicit bbox')
      && openCatalogAcquisitionCore.includes('manifestMutated: false')
      && openCatalogAcquisitionCore.includes('servingEnabled: false')
      && !openCatalogAcquisitionCore.includes('INSTALL spatial')
      && openCatalogAcquisitionCli.includes("process.argv.includes('--confirm-network')")
      && openCatalogAcquisitionCli.includes("process.argv.includes('--print-sql')")
      && !/(firebase|firestore|getStorage|firebase-admin|firebase-functions)/i.test(openCatalogAcquisitionCli)],
  ['open-catalog server artifact boundary is digest-pinned, exact-schema, explicit-area-only, and inactive',
    openCatalogService.includes("createHash('sha256')")
      && openCatalogService.includes('hasExactKeys')
      && openCatalogService.includes("provenance: 'explicit_plan'")
      && openCatalogService.includes('MAX_QUERY_RESULTS = 64')
      && openCatalogService.includes("throw new Error('open-catalog-digest')")
      && openCatalogService.includes("throw new Error('open-catalog-place')")
      && openCatalogService.includes('parseSourceAttributions')
      && !/(firebase|firestore|getStorage|userId|groupId|device|geolocation)/i.test(openCatalogService)
      && !v2Functions.includes("from './open-catalog.js'")
      && json('v2-functions/package.json').scripts?.test?.includes('open-catalog.test.js') === true],
  ['open discovery requires explicit plan geography, group evidence, provenance, and a three-place limit',
    openDiscoveryDomain.includes("provenance: 'explicit_plan'")
      && openDiscoveryDomain.includes("place.operatingStatus !== 'open'")
      && openDiscoveryDomain.includes("save.visibility === 'circle'")
      && openDiscoveryDomain.includes('historyFitCount < 1')
      && openDiscoveryDomain.includes("category === 'drinks' && !input.groupSensitiveCategoryOptIns?.has('drinks')")
      && openDiscoveryDomain.includes("sources: ['Overture open catalog', 'Current group category evidence', 'Explicit plan area']")
      && openDiscoveryDomain.includes('Math.min(input.limit ?? 3, 3)')
      && json('v2/package.json').scripts?.['test:domain']?.includes('openDiscovery.test.js') === true],
  ['cross-provider dedup uses explicit group-visible identity only and fails open on uncertainty',
    openCatalogDomain.includes('resolveKnownOpenPlaceIds')
      && openCatalogDomain.includes("alias.method !== 'user_confirmed' || alias.confidence !== 1")
      && openCatalogDomain.includes('matches.size !== 1')
      && openDiscoveryDomain.includes("save.visibility === 'circle'")
      && openDiscoveryDomain.includes('aliases: input.placeAliases')
      && openCatalogDomainTest.includes('contradictory explicit aliases fail open')
      && openDiscoveryDomainTest.includes('matching name or coordinates never becomes dedup evidence')
      && openDiscoveryDomainTest.includes('a private known identity cannot silently change the group shortlist')
      && openDiscoveryDomainTest.includes('ambiguous explicit aliases suppress neither candidate')
      && openCatalogAliasService.includes("createHash('sha256')")
      && openCatalogAliasService.includes('MAX_ALIAS_READS = 100')
      && openCatalogAliasService.includes("exactKeys(value, ['schemaVersion', 'status', 'ownedPlaceIds', 'confirmedAt'])")
      && openCatalogAliasService.includes("status: 'confirmed' | 'conflicted'")
      && json('v2-functions/package.json').scripts?.test?.includes('open-catalog-alias.test.js') === true
      && openCatalogAliasServiceTest.includes('fail open')
      && rootPackage.scripts?.test?.includes('open-catalog-alias-parity.test.mjs') === true
      && v2Rules.includes('match /placeAliases/{aliasId}')
      && v2Rules.includes('allow read, write: if false;')
      && firestoreRulesTest.includes('a signed-in client cannot read or enumerate server-owned place aliases')
      && firestoreRulesTest.includes('a signed-in client cannot forge a provider alias')],
  ['known and unfamiliar evidence share one final-three ceiling with known evidence first',
    finalShortlistDomain.includes("result.push({ source: 'known'")
      && finalShortlistDomain.includes("result.push({ source: 'open'")
      && finalShortlistDomain.indexOf("source: 'known'") < finalShortlistDomain.indexOf("source: 'open'")
      && finalShortlistDomain.includes('Math.min(input.limit ?? 3, 3)')
      && json('v2/package.json').scripts?.['test:domain']?.includes('finalShortlist.test.js') === true],
  ['durable place memory is user-confirmed and provider snapshots are not copied',
    /function validUserMemory/.test(v2Rules)
      && !/validPlaceSnapshot/.test(executableRules(v2Rules))
      && savesData.includes('memory: place.memory')
      && savesData.includes('export async function setSaveMemory')
      && savesData.includes('if (sameMemory(current.data().memory, memory)) return')
      && savesData.includes('transaction.update(ref, { memory })')
      && savesData.includes('place: deleteField()')
      && groupLifecycle.includes('memory: signal.memory')
      && groupPick.includes('memory: support[0].memory')
      && groupRecommendationDomain.includes("if (save.visibility !== 'circle' || !save.memory) continue")
      && !groupRecommendationDomain.includes('|| !save.memory || !save.place')
      && groupCandidateCard.includes('hex={memory.hex}')
      && groupCandidateCard.includes('{memory.label}</strong>')
      && groupPage.includes('Pass on {pendingPass.save.memory.label}?')
      && groupPage.includes('{picked.save.memory.label}</strong>')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('canonical group memory remains eligible without a compatibility place snapshot')
      && v2Rules.includes("'area' in memory")
      && read('v2/src/domain/placeMemory.ts').includes('userArea?: unknown')
      && read('v2/src/components/PlaceMemoryConfirmation.tsx').includes('It never becomes your home or a location profile.')
      && read('v2/src/pages/Closeup.tsx').includes("next.set('edit', 'details')")
      && read('v2/src/domain/navigation.ts').includes("placeParams.get('edit') === 'details'")
      && groupCandidateCard.includes('card.areaLabel')
      && groupUiVerifier.includes('Area · Confirmed by a group member')
      && groupUiVerifier.includes('Editing place facts must not refresh or change taste evidence.')
      && groupUiVerifier.includes('Focused place-detail editing must remove the dock from its actions.')
      && !/collection\(db, ['"]places['"]\)/.test(candidatesData)],
  ['group-visible profile identity has exact retry and browser-proven recovery',
    userData.includes('await runTransaction(db, async transaction =>')
      && userData.includes('const alreadyExact = Object.entries(clean).every')
      && userData.includes('if (current.onboardedAt) return')
      && read('v2/src/pages/Settings.tsx').includes('Profile change not confirmed.')
      && read('v2/src/pages/Settings.tsx').includes("prototypeFailure('profile-save-response')")
      && read('v2/src/pages/Settings.tsx').includes('Check profile')
      && groupUiVerifier.includes('async function verifyProfileResponseTruth')
      && groupUiVerifier.includes('Profile recovery must freeze every competing avatar choice.')
      && groupUiVerifier.includes('Checking an already-committed profile must preserve its first stored bytes.')
      && groupUiVerifier.includes('group-ui-profile-response-recovery-mobile.png')],
  ['onboarding identity and completion have one exact browser-proven recovery',
    userData.includes('completeOnboarding(): Promise<number>')
      && userData.includes('return current.onboardedAt')
      && userData.includes('Returns true only after a confirmed write')
      && read('v2/src/components/OnboardingGate.tsx').includes("isError || prototypeFailure('onboarding-gate-read')")
      && onboardingPage.includes('That place didn’t load. Check your connection and choose it again.')
      && onboardingPage.includes("'onboarding-identity-response'")
      && onboardingPage.includes("'onboarding-finish-response'")
      && onboardingPage.includes('Identity setup not confirmed.')
      && onboardingPage.includes('Setup completion not confirmed.')
      && onboardingPage.includes('Check setup')
      && groupUiVerifier.includes('async function verifyOnboardingSetupResponseTruth')
      && groupUiVerifier.includes('A failed profile read must remain unknown and must not redirect to onboarding.')
      && groupUiVerifier.includes('Unknown profile data must not masquerade as incomplete onboarding.')
      && groupUiVerifier.includes('Invite identity recovery must freeze every avatar choice.')
      && groupUiVerifier.includes('Checking completed onboarding must preserve its first stored bytes and timestamp.')
      && groupUiVerifier.includes('group-ui-onboarding-identity-response-recovery-mobile.png')
      && groupUiVerifier.includes('group-ui-onboarding-finish-response-recovery-mobile.png')],
  ['new pair Picks are denied and group Picks remain server-owned',
    /match \/picks\/\{pickId\}[\s\S]*?allow create: if false;/.test(v2Rules)
      && /createGroupPick/.test(v2Functions)
      && !/export async function createPick\b/.test(read('v2/src/data/picks.ts'))
      && !/export type NewPick\b/.test(read('v2/src/domain/picks.ts'))
      && read('v2/src/data/picks.ts').includes('if (pick.status === status) return')
      && read('v2/src/data/picks.ts').includes("throw new PickRequestError('pick-outcome-conflict', 409)")],
  ['attributed draft passes sync only for one opaque, expiring, server-owned plan identity',
    groupDraftServer.includes('GROUP_DRAFT_PASS_LIFETIME_MS = 6 * 60 * 60 * 1000')
      && groupDraftServer.includes('GROUP_DRAFT_PASS_LIMIT = 3')
      && groupDraftServer.includes("createHash('sha256')")
      && groupDraftDomain.includes("globalThis.crypto.subtle.digest('SHA-256'")
      && groupDraftHook.includes('groupDraftPassId(draftKey, placeId)')
      && groupsData.includes("doc(db, 'groups', groupId, 'draftPasses', passId)")
      && groupsData.includes("groupPost<Record<string, unknown>>('/updateGroupDraftPass'")
      && groupsData.includes('draftKey: string')
      && groupPage.includes("enabled: !prototype")
      && groupPage.includes("Synced with this group for six hours")
      && groupPage.includes('Pass status unknown.')
      && groupPage.includes("'Check undo'")
      && groupPage.includes('same attributed pass for the reviewed people and plan')
      && /match \/draftPasses\/\{passId\}[\s\S]*?request\.time < resource\.data\.expiresAt\)?\)?;/.test(executableRules(v2Rules))
      && /match \/draftPasses\/\{passId\}[\s\S]*?allow write: if false;/.test(executableRules(v2Rules))
      && /export const updateGroupDraftPass/.test(v2Functions)
      && v2Functions.includes("throw new Error('draft-version-changed')")
      && v2Functions.includes('draftKey !== expectedDraftKey')
      && v2Functions.includes("throw new Error('pass-owned-by-other')")
      && v2Functions.includes("throw new Error('candidate-passed')")
      && read('scripts/check-v2-groups.mjs').includes('exact replay does not rewrite it')
      && groupUiVerifier.includes('async function verifyDraftPassResponseTruth')
      && groupUiVerifier.includes('group-ui-draft-pass-save-recovery-mobile.png')
      && groupUiVerifier.includes('group-ui-draft-pass-undo-recovery-mobile.png')
      && read('scripts/check-v2-data-rights.mjs').includes('exported.groupDraftPasses.length')
      && json('v2/package.json').scripts?.['test:domain']?.includes('groupDraft.test.js') === true
      && json('v2-functions/package.json').scripts?.test?.includes('group-draft.test.js') === true],
  ['account deletion locks writes and binds its opaque retry to one exact account',
    /function\s+accountActive[\s\S]*?deleting/.test(executableRules(v2Rules))
      && accountData.includes('crypto.getRandomValues(new Uint8Array(32))')
      && accountData.includes('accountDeletionOperationKey(uid: string)')
      && accountData.includes('clearAccountDeletionOperation(uid: string, operationKey: string)')
      && accountData.includes('deleteMyAccount(operationKey: string, expectedUid: string)')
      && accountData.includes('userBeforeToken.uid !== expectedUid')
      && accountData.includes('userAfterToken.uid !== expectedUid')
      && accountData.includes('deletionCompletionStillBelongsTo(uid: string)')
      && /deleteMyAccount\(operationKey: string, expectedUid: string\)[\s\S]*?userBeforeToken[\s\S]*?getIdToken\(true\)[\s\S]*?userAfterToken[\s\S]*?fetch\('\/deleteMyAccount'/.test(accountData)
      && /deletionCompletionStillBelongsTo\(uid: string\)[\s\S]{0,220}auth\.currentUser[\s\S]{0,220}currentUser\.uid === uid/.test(accountData)
      && accountDeletionOperationDomain.includes("const LEGACY_STORAGE_KEY = 'this-is:v2:account-deletion-operation'")
      && accountDeletionOperationDomain.includes('storage.removeItem(LEGACY_STORAGE_KEY)')
      && accountDeletionOperationDomain.includes('storage.getItem(key) !== operationKey')
      && settingsPage.includes('<DataAndAccount key={session.user.uid} uid={session.user.uid} />')
      && dataAndAccount.includes('deleteMyAccount(completedOperationKey, uid)')
      && dataAndAccount.includes('if (!deletionCompletionStillBelongsTo(uid)) return')
      && dataAndAccount.includes("error.code === 'account-changed'")
      && /await deleteMyAccount\(completedOperationKey, uid\)[\s\S]{0,500}clearAccountDeletionOperation\(uid, completedOperationKey\)[\s\S]{0,500}deletionCompletionStillBelongsTo\(uid\)[\s\S]{0,500}queryClient\.clear\(\)[\s\S]{0,300}signOutUser\(\)/.test(dataAndAccount)
      && accountData.includes("body: JSON.stringify({ confirmation: 'DELETE', operationKey })")
      && v2Functions.includes("collection('accountDeletionOps')")
      && v2Functions.includes("createHash('sha256').update(operationKey).digest('hex')")
      && v2Functions.includes("status: 'cleanup-complete'")
      && v2Functions.includes('uid: FieldValue.delete()')
      && /claimedOperation\.status === 'complete'[\s\S]{0,400}response\.status\(409\)/.test(v2Functions)
      && /match \/accountDeletionOps\/\{operationId\}[\s\S]*?allow read, write: if false;/.test(executableRules(v2Rules))
      && read('scripts/check-v2-data-rights.mjs').includes('PASS unauthenticated exact deletion replay remains a no-op success after Auth removal')
      && read('scripts/check-v2-data-rights.mjs').includes('PASS an authenticated second account cannot reuse a completed deletion key or alter either account')
      && /deletionOperationBeforeReplay[\s\S]*?auth\.getUser\(uid\)[\s\S]*?const deletionReplay[\s\S]*?deletionOperationAfterReplay[\s\S]*?updateTime/.test(read('scripts/check-v2-data-rights.mjs'))
      && json('v2/package.json').scripts?.['test:domain']?.includes('accountDeletionOperation.test.js') === true
      && dataAndAccount.includes('Account deletion not confirmed.')
      && dataAndAccount.includes('Check deletion')
      && groupUiVerifier.includes('async function verifyAccountDeletionResponseTruth')
      && groupUiVerifier.includes('group-ui-account-delete-response-recovery-mobile.png')],
  ['owner export and deletion endpoints are in the canonical backend', /export const exportMyData/.test(v2Functions) && /export const deleteMyAccount/.test(v2Functions)],
  ['Settings explains canonical data rights with safe destructive recovery',
    dataAndAccount.includes('PRIVACY &amp; DATA')
      && dataAndAccount.includes('group memberships and contributions')
      && !dataAndAccount.includes('Export your canonical profile, signals, notes, connections')
      && dataAndAccount.includes('role="alertdialog"')
      && dataAndAccount.includes('The frozen legacy production system has a separate owner-reviewed cleanup.')
      && dataAndAccount.includes("event.key !== 'Escape'")
      && dataAndAccount.includes('Keep my account')
      && groupUiVerifier.includes('Settings data rights must not lead with retired pair-model vocabulary.')
      && groupUiVerifier.includes('Account deletion confirmation must focus the safe Keep my account action first.')
      && groupUiVerifier.includes('Escape must close account deletion and restore its trigger.')
      && groupUiVerifier.includes('The exact DELETE phrase must enable—but never automatically invoke—the destructive action.')],
  ['trusted group lifecycle is integration-tested',
    rootPackage.scripts?.['verify:groups']?.includes('check-v2-groups.mjs') === true
      && /export const createGroup/.test(v2Functions)
      && /export const acceptGroupInvite/.test(v2Functions)
      && /export const revokeGroupInvite/.test(v2Functions)
      && /export const listGroupInvites/.test(v2Functions)
      && /export const revokeClosedGroupInvites/.test(v2Functions)
      && v2Functions.includes('memberCountAtCreation')
      && groupInvitePage.includes('Membership may have changed since then.')
      && read('scripts/check-v2-groups.mjs').includes('concurrent invite snapshots stay historical')
      && read('scripts/check-v2-groups.mjs').includes('active links cannot over-reserve six seats')
      && read('scripts/check-v2-groups.mjs').includes('only the link creator can revoke an unused invite')
      && v2Functions.includes("inviteData.revokedReason === 'creator-revoked'")
      && read('scripts/check-v2-groups.mjs').includes('exact retry cannot rewrite it')
      && read('scripts/check-v2-groups.mjs').includes('creator invite recovery is authenticated, bounded')
      && read('scripts/check-v2-groups.mjs').includes('does not exist, valid functions are:')
      && read('scripts/check-v2-groups.mjs').includes('Timed out waiting for the ${path} emulator function to register.')
      && v2Functions.includes('invite-capacity-reserved')
      && /export const saveGroupQuickStart/.test(v2Functions)
      && /export const shareGroupSignal/.test(v2Functions)
      && /export const syncGroupSignalProjections/.test(v2Functions)
      && projectionSync.includes('planProjectionSync')
      && projectionSync.includes('includeNote')
      && projectionSync.includes('includeObservations')
      && groupLifecycle.includes('includeNote,')
      && groupLifecycle.includes('includeObservations = false')
      && v2Rules.includes('validPrivateObservations')
      && read('scripts/check-v2-groups.mjs').includes('place memory, notes, and observations synchronize without widening explicit group consent')
      && v2Functions.includes('return { changed: false, deleteGroup: false }')
      && read('scripts/check-v2-groups.mjs').includes('leaving is retry-safe, outsiders cannot mutate it')
      && json('v2/package.json').scripts?.['test:domain']?.includes('placeObservations.test.js') === true
      && /export const createGroupPick/.test(v2Functions)
      && v2Functions.includes('groupPickDocumentIds')
      && v2Functions.includes("throw new Error('pick-operation-conflict')")
      && groupPage.includes('confirm whether the Pick was made.')
      && groupPage.includes('make a second Pick.')
      && groupPage.includes("pickCommitFailure === 'unknown'")
      && groupUiVerifier.includes('An ambiguous Pick response must not present the recovery as a fresh commitment.')
      && read('scripts/check-v2-groups.mjs').includes('Pick replay returns one committed decision and one receipt')
      && /export const closeGroupPick/.test(v2Functions)
      && /export const migratePairToGroup/.test(v2Functions)
      && v2Functions.includes("return { groupId: groupRef.id, migrated: false }")
      && togetherPage.includes('Check group with ${person.displayName}')
      && togetherPage.includes('same two-person group; it cannot add people or move private places or notes')
      && groupUiVerifier.includes('async function verifyPairMigrationResponseTruth')
      && groupUiVerifier.includes('group-ui-pair-migration-recovery-mobile.png')
      && read('scripts/check-v2-groups.mjs').includes('without rewriting the audience, projections, Picks, or private notes')
      && /export const pickReceipt/.test(v2Functions)
      && /export const revokePickReceipt/.test(v2Functions)],
  ['one current and one replaceable recent Pick pointer keep group and personal outcomes separate',
    groupsDomain.includes('export interface ActiveGroupPickSummary')
      && groupsDomain.includes('activePick?: ActiveGroupPickSummary')
      && groupsDomain.includes('export interface RecentGroupPickSummary')
      && groupsDomain.includes('recentPick?: RecentGroupPickSummary')
      && v2Functions.includes("throw new Error('pick-already-open')")
      && v2Functions.includes('activePick: {')
      && v2Functions.includes('activePick: FieldValue.delete()')
      && v2Functions.includes('recentPick: { ...groupData.activePick, visitedAt: closedAt }')
      && v2Functions.includes('recentPick: FieldValue.delete()')
      && v2Functions.includes('selectedLegacyPicks')
      && v2Functions.includes('migratedActivePick')
      && togetherPage.includes('Current Pick · ${group.activePick.label}')
      && togetherPage.includes('Last Pick · ${group.recentPick.label}')
      && groupPage.includes('Open current Pick')
      && groupPage.includes('Open last Pick')
      && groupPage.includes('Close this Pick after the outing before this group starts another.')
      && groupUiVerifier.includes('Closing the Pick must remove its recovery pointer from Together.')
      && groupUiVerifier.includes('A dismissed plan must not pretend the group visited.')
      && groupUiVerifier.includes('A visited Pick must expose one personal outcome system')
      && closeupPage.includes('We went')
      && closeupPage.includes('Only your Keep changes.')
      && closeupPage.includes('Other people choose for themselves.')
      && closeupPage.includes('confirm how the Pick closed.')
      && closeupPage.includes('close it twice or change the outcome.')
      && v2Functions.includes("throw new Error('pick-outcome-conflict')")
      && groupUiVerifier.includes('An ambiguous dismissal must not claim that the Pick remains open.')
      && read('scripts/check-v2-groups.mjs').includes('terminal Pick replay recovers the same outcome while conflicting closure stays impossible')
      && read('scripts/check-v2-groups.mjs').includes("secondOpenPick.payload.error, 'pick-already-open'")
      && read('scripts/check-v2-groups.mjs').includes("recentPick?.id, groupPick.payload.id")
      && read('scripts/check-v2-groups.mjs').includes("data()?.tag, 'want'")
      && read('scripts/check-v2-groups.mjs').includes("activePick' in group.data(), false")],
  ['an open Pick leads with Maps and keeps personal maintenance deliberately secondary',
    closeupPage.includes('Open in Google Maps ↗')
      && closeupPage.includes('AFTER THE OUTING')
      && closeupPage.includes('<details className="pick-after-visit">')
      && closeupPage.includes('closeup-personal-memory${hasOpenPick')
      && componentsCss.includes('.closeup-personal-memory.is-secondary')
      && componentsCss.includes('.pick-after-visit')
      && groupUiVerifier.includes('The Maps handoff must lead before after-outing controls and fit in the first mobile viewport.')
      && groupUiVerifier.includes('After-outing maintenance must start collapsed on a newly committed Pick.')
      && groupUiVerifier.includes('An open shared Pick must keep personal-memory maintenance collapsed by default.')
      && groupUiVerifier.includes('Personal Keep must remain deliberately reachable while the shared Pick is open.')
      && groupUiVerifier.includes('Once the shared Pick closes, ordinary personal-memory controls must return without another disclosure task.')],
  ['member chat return is clipboard-proven and receipt revocation is deliberate',
    closeupPage.includes('SEND TO THE CHAT')
      && closeupPage.includes('A 30-day no-sign-in link')
      && closeupPage.includes('No names, notes, or taste history.')
      && closeupPage.includes('Stop this Pick link?')
      && closeupPage.includes('Keep link active')
      && closeupPage.includes('confirm whether the public link was revoked.')
      && closeupPage.includes('cannot restore or replace it.')
      && closeupPage.includes("event.key !== 'Escape'")
      && picksData.includes('prototype-receipt-')
      && picksData.includes("throw new Error('receipt-unavailable')")
      && v2Functions.includes("if (typeof data.shareToken !== 'string') return")
      && groupUiVerifier.includes('The chat bridge must copy only the opaque public receipt URL')
      && groupUiVerifier.includes('Receipt revocation must focus the safe Keep link active action first.')
      && groupUiVerifier.includes('Escape must close receipt revocation and restore its trigger.')
      && groupUiVerifier.includes('Prototype revocation must persist across the same recovery boundary as the Pick.')
      && groupUiVerifier.includes('An ambiguous receipt response must not claim that the public link still works.')
      && read('scripts/check-v2-groups.mjs').includes('exact retry cannot restore or recount it')],
  ['no-install receipt rendering is browser-proven across its public lifecycle',
    rootPackage.scripts?.['verify:group-ui']?.includes('npm --prefix v2-functions run build') === true
      && pickReceiptServer.includes('renderUnavailablePickReceiptHtml')
      && pickReceiptServer.includes('That Pick link is no longer available.')
      && pickReceiptServer.includes('were on the plan')
      && v2Functions.includes("response.status(404).type('html')")
      && groupUiVerifier.includes('verifyPublicPickReceipt(browser)')
      && groupUiVerifier.includes('Rendering a receipt must make no background request')
      && groupUiVerifier.includes('The complete selected receipt must fit the initial 390×844 viewport.')
      && groupUiVerifier.includes('A visited receipt must not say the plan is still open.')
      && groupUiVerifier.includes('An unavailable no-install receipt must not manufacture an account or navigation task.')
      && read('scripts/check-v2-groups.mjs').includes('That Pick link is no longer available')],
  ['the visited Last Pick is suppressed from the next bounded shortlist',
    groupRecommendationDomain.includes('excludePlaceIds?: readonly string[]')
      && groupRecommendationDomain.includes('exclusions.has(save.placeId)')
      && groupPage.includes('excludePlaceIds: [group.recentPick.placeId]')
      && groupPick.includes('excludedPlaceIds?.includes(input.placeId)')
      && v2Functions.includes('recentPlaceId ? { excludedPlaceIds: [recentPlaceId] }')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('a recent Pick is suppressed from the next bounded shortlist')
      && read('v2-functions/src/group-pick.test.ts').includes('the server candidate boundary suppresses the current Last Pick')
      && read('scripts/check-v2-groups.mjs').includes('the Last Pick is suppressed until a different supported place starts the next decision')
      && groupUiVerifier.includes('The Last Pick must not immediately reappear as an ordinary fresh candidate.')],
  ['an attendee without a prior save confirms Pick memory privately without speculative Details',
    closeupPage.includes('const pickMemory = pick && isGroupPick(pick) && pick.placeId === id')
      && closeupPage.includes('pickLookupReady && !prototype && !snapshot')
      && closeupPage.includes("This came from the group’s Pick. Confirm or rewrite it before it becomes your private place memory.")
      && closeupPage.includes("initialLabel={pendingSave.source === 'pick' ? pickMemory?.label : undefined}")
      && groupUiVerifier.includes('Prefilling Pick memory must not save it before explicit confirmation.')
      && groupUiVerifier.includes('A confirmed Pick outcome must create only a private personal memory')
      && groupUiVerifier.includes('A personal Pick outcome must not silently project the place back into its group.')],
  ['an open group page receives live membership without polling or speculative taste',
    queriesData.includes("onSnapshot(doc(db, 'groups', groupId)")
      && queriesData.includes('planLiveGroupSummary(current, next)')
      && !/refetchInterval/.test(queriesData)
      && groupLiveStateDomain.includes("{ action: 'refetch' }")
      && groupLiveStateDomain.includes('current.permissionVersion !== next.permissionVersion')
      && groupLiveStateDomain.includes("{ uid: member.uid, name: member.displayName, saves: [] }")
      && json('v2/package.json').scripts?.['test:domain']?.includes('groupLiveState.test.js') === true],
  ['the displayed creator invite closes live after acceptance or revocation',
    read('v2/src/data/groups.ts').includes('watchGroupInviteClosure')
      && read('v2/src/data/groups.ts').includes("snapshot.data().status !== 'active'")
      && groupInviteManager.includes('watchGroupInviteClosure')
      && groupInviteManager.includes("setStatus('closed')")
      && groupInviteManager.includes('listGroupInvites(groupId)')],
  ['zero-history group entry is optional, bounded, and lifecycle-covered',
    groupInvitePage.includes('?welcome=1')
      && groupPage.includes('Quick start')
      && groupPage.includes('Choose or find a place')
      && groupPage.includes('Not now')
      && groupPage.includes('quick-start-save-response')
      && groupPage.includes('quick-start-remove-response')
      && groupUiVerifier.includes('An ambiguous Quick start save must not present a fresh Share hint action.')
      && groupUiVerifier.includes('Quick start choices must stay frozen while the exact save result is unknown.')
      && groupUiVerifier.includes('Removing Quick start must never reopen the fixed audience after closing recovery.')
      && groupQuickStartComponent.includes('Checking again can only save these same choices; it cannot reopen invitations')
      && groupQuickStartComponent.includes('cannot reopen invitations or remove anything from your personal Keep.')
      && v2Functions.includes('if (unchanged && state.membershipLocked) return')
      && read('scripts/check-v2-groups.mjs').includes('Quick start save and removal replay without rewriting')
      && /nothing required/i.test(groupPage)
      && groupQuickStartDomain.includes("['food', 'coffee', 'activity']")
      && !groupQuickStartDomain.includes('drinks')
      && /export const saveGroupQuickStart/.test(v2Functions)
      && json('v2/package.json').scripts?.['test:domain']?.includes('groupQuickStart.test.js') === true],
  ['candidate cards distinguish evidence strength, source every layer, and keep unknown facts honest',
    candidateCardDomain.includes("'known_match' | 'member_introduction' | 'weak_fit' | 'taste_fit'")
      && !candidateCardDomain.includes('MEMBER SUGGESTION')
      && groupRecommendationDomain.includes('evidence.supporters.length >= 2')
      && groupRecommendationDomain.includes('(evidence.wantCount >= 1 && evidence.hintMatches.length >= 1)')
      && groupPick.includes('support.length < 2 && loved.length === 0 && quickMatches.length === 0')
      && candidateCardDomain.includes('Hours, price, accessibility, and group fit are not verified here.')
      && candidateCardDomain.includes('Confirmed by a group member')
      && candidateCardDomain.includes('Member-chosen category')
      && groupCandidateCard.includes('NO PHOTO · PLACE MARK')
      && groupCandidateCard.includes('candidate.sharedNote.text')
      && groupCandidateCard.includes('candidate.sharedNote.authorName')
      && read('v2/src/domain/signals.ts').includes('PRIVATE_PLACE_NOTE_MAX_LENGTH = 280')
      && read('v2/src/domain/signals.ts').includes('SHARED_PLACE_NOTE_MAX_LENGTH = 180')
      && read('v2/src/pages/Closeup.tsx').includes('What to order, when it works, or why you’d return.')
      && read('v2/src/pages/Closeup.tsx').includes('maxLength={PRIVATE_PLACE_NOTE_MAX_LENGTH}')
      && groupUiVerifier.includes('The practical note must enforce the canonical private-note limit before save.')
      && groupUiVerifier.includes('Order the cardamom bun after practice.')
      && groupCandidateCard.includes('candidate.sharedObservations')
      && groupRecommendationDomain.includes('Observers never affect support, ranking, or the')
      && read('v2/src/domain/groupRecommendation.test.ts').includes('Tried observations alone cannot manufacture an eligible candidate')
      && groupCandidateCard.includes('aria-pressed')
      && json('v2/package.json').scripts?.['test:domain']?.includes('candidateCard.test.js') === true],
  ['the client shortlist and Pick server share an executable recommendation contract',
    rootPackage.scripts?.test?.includes('scripts/group-recommendation-parity.test.mjs') === true
      && groupRecommendationParity.includes("name: 'one unsupported Want stays ineligible'")
      && groupRecommendationParity.includes("name: 'one Want plus another member hint'")
      && groupRecommendationParity.includes("name: 'one Love introduces a place'")
      && groupRecommendationParity.includes("name: 'guest remains unknown'")
      && groupRecommendationParity.includes("name: 'explicit plan area rejects a different place area'")
      && groupRecommendationParity.includes("name: 'any attributed No fails a practical requirement closed'")
      && groupRecommendationParity.includes('assert.deepEqual(client, server')],
  ['repeated candidate actions identify the exact place to assistive technology',
    groupCandidateCard.includes('Choose ${memory.label} for this plan')
      && groupCandidateCard.includes('${memory.label} selected for this plan')
      && groupCandidateCard.includes('How this card knows: ${memory.label}')
      && groupCandidateCard.includes('Not for us: ${memory.label}')
      && groupUiVerifier.includes('candidate choice must have one concise place-specific accessible name.')
      && groupUiVerifier.includes('repeated evidence and pass actions must identify their place.')
      && groupUiVerifier.includes('every candidate must visibly identify its reversible Choose action.')
      && groupUiVerifier.includes('The visible Chosen state and accessible pressed state must agree before commitment.')
      && groupCandidateCard.includes("selected ? 'Chosen ✓' : 'Choose →'")
      && groupUiVerifier.includes('source disclosure must be touch-sized.')
      && groupUiVerifier.includes('pass action must be touch-sized.')],
  ['migration command is read-only planning', rootPackage.scripts?.['migration:plan'] === 'node scripts/plan-v2-migration.mjs'],
  ['migration planner contains no Firestore write operation', !/\.(set|create|update|delete)\s*\(/.test(migrationPlanner)],
  ['migration invariants run in the canonical test suite', json('v2/package.json').scripts?.test?.includes('test:migration') === true],
  ['legacy erasure command is read-only planning', rootPackage.scripts?.['erasure:plan'] === 'node scripts/plan-v1-erasure.mjs'],
  ['legacy erasure planner contains no Firestore mutation', !/\.(set|create|update|delete)\s*\(/.test(erasurePlanner.replace(/records\.set/g, 'records.record'))],
  ['legacy erasure invariants run in the canonical test suite', rootPackage.scripts?.test?.includes('v1-erasure-core.test.mjs') === true],
  ['external prototype archive command is read-only planning',
    rootPackage.scripts?.['archive:plan'] === 'node scripts/plan-external-v2-archive.mjs'
      && rootPackage.scripts?.test?.includes('external-v2-archive-core.test.mjs') === true],
  ['external archive planner hard-allowlists read-only Git commands and has no filesystem writer',
    /READ_ONLY_GIT_COMMANDS = new Set\(\['branch', 'ls-files', 'rev-parse', 'status'\]\)/.test(externalArchivePlanner)
      && !/\b(?:writeFile|appendFile|copyFile|rename|unlink|rm|mkdir|rmdir|truncate)\w*\s*\(/.test(externalArchivePlanner)],
  ['observability delivery and aggregate privacy run in the canonical test suite', rootPackage.scripts?.test?.includes('verify:observability') === true],
  ['observability verification covers summary invariants and rules-backed delivery',
    rootPackage.scripts?.['verify:observability']?.includes('pilot-summary-core.test.mjs') === true
      && rootPackage.scripts?.['verify:observability']?.includes('observability-integration.mjs') === true],
  ['pilot decision protocol is executable and tested',
    rootPackage.scripts?.['pilot:decision'] === 'node scripts/evaluate-v2-pilot.mjs'
      && rootPackage.scripts?.test?.includes('pilot-decision-core.test.mjs') === true],
  ['group-native Phase B decision protocol is executable, aggregate-only, and tested',
    rootPackage.scripts?.['group-pilot:decision'] === 'node scripts/evaluate-group-pilot.mjs'
      && rootPackage.scripts?.test?.includes('group-pilot-decision-core.test.mjs') === true
      && read('scripts/group-pilot-decision-core.mjs').includes('proceed_group_private_preview')
      && read('scripts/group-pilot-decision-core.mjs').includes('outputContainsNamesIdsPlacesNotesChatQueriesOrRawVetoes')
      && read('group-pilot-evidence.template.json').includes('"organizerActionShareBand"')],
  ['privacy-bounded Phase 0 decision protocol is executable and tested',
    rootPackage.scripts?.['phase0:decision'] === 'node scripts/evaluate-phase0.mjs'
      && rootPackage.scripts?.test?.includes('phase0-decision-core.test.mjs') === true
      && read('phase0-evidence.template.json').includes('"schemaVersion": 2')
      && read('phase0-evidence.template.json').includes('"week1UnpromptedSaves"')
      && read('phase0-evidence.template.json').includes('"week2UnpromptedSaves"')
      && read('phase0-evidence.template.json').includes('"privacyFailureObserved"')
      && phase0Protocol.includes('Saved is not Want, starred is not Loved')
      && phase0Protocol.includes('does not test or authorize bulk import')
      && phase0Protocol.includes('Seed confirmations are setup density, not logging behavior.')
      && phase0Protocol.includes('Week 2 retains at least 25% of')
      && pilotOperatorKit.includes('Never convert saved/starred state')
      && read('scripts/phase0-decision-core.mjs').includes('row.week2UnpromptedSaves * 4 >= row.week1UnpromptedSaves')
      && read('scripts/phase0-decision-core.test.mjs').includes('one week-2 trickle cannot conceal')
      && read('scripts/phase0-decision-core.test.mjs').includes('schema v2 refuses ambiguous legacy save counts')],
  ['participant contact has a strict local readiness preflight',
    rootPackage.scripts?.['pilot:preflight'] === 'node scripts/check-pilot-operator-readiness.mjs'
      && rootPackage.scripts?.test?.includes('pilot-operator-readiness-core.test.mjs') === true
      && read('.gitignore').split(/\r?\n/).includes('pilot-operator-readiness.local.json')
      && pilotOperatorReadinessCore.includes('passiveLocationExcluded')
      && pilotOperatorReadinessCore.includes('deletionRehearsedOn')
      && pilotOperatorReadinessCore.includes('approvedForContact')
      && pilotOperatorReadinessCli.includes('BLOCK participant contact')
      && pilotOperatorReadinessCli.includes('Never add participant names, contacts, places, notes, or evidence')
      && pilotOperatorReadinessTemplate.includes('REPLACE_WITH_PARTICIPANT_FACING_OPERATOR_IDENTITY')
      && read('docs/product-reset/PILOT_OPERATOR_KIT.md').includes('npm run pilot:preflight')],
  ['document authority is executable and part of the canonical test gate',
    rootPackage.scripts?.['docs:check'] === 'node scripts/check-doc-authority.mjs'
      && rootPackage.scripts?.test?.startsWith('npm run docs:check &&') === true],
  ['canonical app and Functions declare one Node 22 runtime',
    rootPackage.engines?.node === '22'
      && json('v2/package.json').engines?.node === '22'
      && json('v2-functions/package.json').engines?.node === '22'
      && nodeVersionPin === '22'
      && nvmPin === '22'
      && rootPackage.scripts?.['runtime:check'] === 'node scripts/check-node-runtime.mjs'],
  ['reviewed cutover evidence has a local validator, template, and tests',
    rootPackage.scripts?.['cutover:evidence'] === 'node scripts/check-cutover-evidence.mjs'
      && rootPackage.scripts?.test?.includes('cutover-evidence-core.test.mjs') === true
      && cutoverEvidenceTemplate.includes('"prototypeBackdoorAbsent"')
      && cutoverEvidenceTemplate.includes('"costControls"')
      && cutoverEvidenceTemplate.includes('"groupPilot"')
      && cutoverEvidenceTemplate.includes('"remoteKillSwitchVerified"')
      && cutoverEvidenceTemplate.includes('"reportSha256"')
      && cutoverEvidenceTemplate.includes('"hostingReleaseId"')],
]

const blockers = [
  ['frozen root rules file still contains prototype access', /function\s+isDevMode|2030/.test(executableRules(liveRules))],
  ['external clean-room prototype still exists and awaits manual archive', existsSync(resolve(root, '..', 'this-is-v2'))],
  [`current Node ${process.versions.node} does not match the production Functions 22.x runtime`, Number(process.versions.node.split('.')[0]) !== 22],
  ['required signals composite index has no reviewed deployed/READY evidence field', !cutoverEvidenceTemplate.includes('"indexes"')],
  [`reviewed cutover evidence has ${cutoverEvidenceIssues.length} unresolved issue${cutoverEvidenceIssues.length === 1 ? '' : 's'}`, cutoverEvidenceIssues.length > 0],
  ['legacy pair invite/overlap/plan routes remain after conversion',
    groupDirection.includes('approved product direction')
      && (
        /pages\/(Invite|Overlap|Plan)/.test(appRoutes)
        || /createInviteToken|acceptInvite|fetchInvite/.test(connectionsData)
        || !/match \/invites\/\{token\}[\s\S]*?allow read, write: if false;/.test(v2Rules)
        || !/match \/connections\/\{connectionId\}[\s\S]*?allow create: if false;/.test(v2Rules)
      )],
  ['Google-derived durable place snapshots and 30-day deletion remain unresolved',
    /validPlaceSnapshot/.test(executableRules(v2Rules))
      || /collection\(db, ['"]places['"]\)/.test(candidatesData)
      || !savesData.includes('place: deleteField()')
      || !groupLifecycle.includes('memory: signal.memory')
      || !groupPick.includes('memory: support[0].memory')],
  ['public Places Terms and Privacy await owner identity, contact, and legal review',
    !termsPage || !privacyPage
      || termsPage.includes('pending-owner-identity-and-contact')
      || privacyPage.includes('pending-owner-identity-and-contact')],
]

console.log('this.is canonical status')
for (const [label, pass] of structural) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`)
console.log('\nproduction cutover blockers')
for (const [label, blocked] of blockers) console.log(`${blocked ? 'BLOCK' : 'CLEAR'} ${label}`)
if (cutoverEvidenceIssues.length) {
  console.log('\nreviewed cutover evidence gaps')
  for (const issue of cutoverEvidenceIssues) console.log(`- ${issue}`)
}

const structuralFailure = structural.some(([, pass]) => !pass)
const activeBlocker = blockers.some(([, blocked]) => blocked)
if (strict && (structuralFailure || activeBlocker)) {
  console.error('\nCutover refused. Resolve every FAIL and BLOCK before deploying.')
  process.exit(1)
}

console.log(`\nStatus: ${structuralFailure || activeBlocker ? 'canonical locally; production cutover not ready' : 'ready for reviewed cutover'}`)
