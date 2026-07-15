const FUNCTION_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function duplicates(values) {
  const seen = new Set()
  return values.filter(value => seen.has(value) || !seen.add(value))
}

function exactSet(left, right) {
  return JSON.stringify(sorted(new Set(left))) === JSON.stringify(sorted(new Set(right)))
}

function stringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && FUNCTION_NAME.test(item))
}

export function exportedFunctionNames(source) {
  return [...String(source).matchAll(/^export const ([A-Za-z][A-Za-z0-9_]*)\s*=/gm)]
    .map(match => match[1])
}

/** Validate the non-deploying review artifacts that bound a future alpha deploy. */
export function familyAlphaSurfaceIssues({ surface, firebaseConfig, functionsSource }) {
  const issues = []
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) return ['surface:not-object']
  const keys = Object.keys(surface).sort()
  if (JSON.stringify(keys) !== JSON.stringify([
    'authClaim',
    'codebase',
    'deployFunctions',
    'excludedFunctions',
    'hostingFunctions',
    'schemaVersion',
  ])) issues.push('surface:unexpected-schema')
  if (surface.schemaVersion !== 2) issues.push('surface:schema-version')
  if (surface.codebase !== 'family-alpha') issues.push('surface:codebase')
  if (surface.authClaim !== 'familyAlpha') issues.push('surface:auth-claim')

  for (const field of ['deployFunctions', 'hostingFunctions', 'excludedFunctions']) {
    if (!stringArray(surface[field])) issues.push(`surface:${field}`)
    else if (duplicates(surface[field]).length) issues.push(`surface:${field}:duplicates`)
  }
  if (issues.some(issue => /^surface:(?:deployFunctions|hostingFunctions|excludedFunctions)(?::|$)/.test(issue))) {
    return [...new Set(issues)]
  }

  const deploy = surface.deployFunctions
  const hosting = surface.hostingFunctions
  const excluded = surface.excludedFunctions
  const exported = exportedFunctionNames(functionsSource)
  if (!excluded.includes('placePhoto')) issues.push('surface:place-photo-not-excluded')
  if (deploy.includes('placePhoto') || hosting.includes('placePhoto')) issues.push('surface:place-photo-exposed')
  if (deploy.some(name => excluded.includes(name))) issues.push('surface:deploy-excluded-overlap')
  if (hosting.some(name => !deploy.includes(name))) issues.push('surface:hosting-outside-deploy')
  if (!exactSet([...deploy, ...excluded], exported)) issues.push('surface:function-partition-drift')

  const config = firebaseConfig && typeof firebaseConfig === 'object' ? firebaseConfig : {}
  if ('emulators' in config) issues.push('config:emulators-not-allowed')
  if (config.firestore?.rules !== 'v2/.family-alpha-rules/firestore.rules') issues.push('config:rules-path')
  if (config.firestore?.indexes !== 'v2/firestore.indexes.json') issues.push('config:indexes-path')
  const functionConfigs = Array.isArray(config.functions) ? config.functions : []
  if (functionConfigs.length !== 1) issues.push('config:function-codebase-count')
  const functionConfig = functionConfigs[0] ?? {}
  if (functionConfig.source !== 'v2-functions/.family-alpha-deploy') issues.push('config:function-source')
  if (functionConfig.codebase !== surface.codebase) issues.push('config:function-codebase')
  if (!Array.isArray(functionConfig.predeploy)
    || !functionConfig.predeploy.includes('npm --prefix "$RESOURCE_DIR" run build')) {
    issues.push('config:function-predeploy')
  }
  if (config.hosting?.public !== 'v2/.family-alpha-dist') issues.push('config:hosting-public')
  const ignore = Array.isArray(config.hosting?.ignore) ? config.hosting.ignore : []
  for (const required of ['firebase.family-alpha.json', '**/.*', '**/node_modules/**']) {
    if (!ignore.includes(required)) issues.push(`config:hosting-ignore:${required}`)
  }

  const rewrites = Array.isArray(config.hosting?.rewrites) ? config.hosting.rewrites : []
  const functionRewrites = rewrites.filter(rewrite => rewrite?.function?.functionId)
  const rewriteFunctions = functionRewrites.map(rewrite => rewrite.function.functionId)
  if (!exactSet(rewriteFunctions, hosting)) issues.push('config:hosting-function-drift')
  if (duplicates(rewriteFunctions).length) issues.push('config:hosting-function-duplicates')
  if (functionRewrites.some(rewrite => rewrite.function.region !== 'us-central1'
    || rewrite.function.pinTag !== true)) issues.push('config:hosting-function-options')
  const catchAll = rewrites.at(-1)
  if (catchAll?.source !== '**' || catchAll?.destination !== '/index.html') {
    issues.push('config:hosting-catch-all')
  }
  if (rewriteFunctions.includes('placePhoto')) issues.push('config:place-photo-rewrite')

  return [...new Set(issues)]
}
