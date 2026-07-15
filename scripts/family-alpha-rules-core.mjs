const CLAIM_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

const CANONICAL_SIGNED_IN = /    function signedIn\(\) \{\r?\n      return request\.auth != null;\r?\n    \}/g

function lineBreak(source) {
  return String(source).includes('\r\n') ? '\r\n' : '\n'
}

/**
 * Produce the alpha ruleset by strengthening only the canonical signedIn helper.
 * Any canonical drift fails closed instead of yielding a subtly different ruleset.
 */
export function generateFamilyAlphaRules(canonicalSource, claimName = 'familyAlpha') {
  if (!CLAIM_NAME.test(claimName) || claimName !== 'familyAlpha') {
    throw new Error('Family-alpha rules require the reviewed familyAlpha claim.')
  }
  const canonical = String(canonicalSource)
  const matches = [...canonical.matchAll(CANONICAL_SIGNED_IN)]
  if (matches.length !== 1) {
    throw new Error('Expected exactly one canonical signedIn helper in Firestore rules.')
  }

  const nl = lineBreak(canonical)
  const strengthened = [
    '    function signedIn() {',
    '      return request.auth != null',
    `        && '${claimName}' in request.auth.token`,
    `        && request.auth.token.${claimName} == true;`,
    '    }',
  ].join(nl)
  return canonical.replace(CANONICAL_SIGNED_IN, strengthened)
}

/** Verify that generated rules are exactly the deterministic transformation. */
export function familyAlphaRulesIssues({ canonicalSource, generatedSource, claimName = 'familyAlpha' }) {
  const issues = []
  let expected
  try {
    expected = generateFamilyAlphaRules(canonicalSource, claimName)
  } catch {
    return ['rules:canonical-boundary-drift']
  }
  if (String(generatedSource) !== expected) issues.push('rules:generated-drift')
  if (!String(generatedSource).includes(`'${claimName}' in request.auth.token`)
    || !String(generatedSource).includes(`request.auth.token.${claimName} == true`)) {
    issues.push('rules:claim-boundary-missing')
  }
  if (String(generatedSource).includes('return request.auth != null;')) {
    issues.push('rules:unbounded-signed-in')
  }
  return issues
}
