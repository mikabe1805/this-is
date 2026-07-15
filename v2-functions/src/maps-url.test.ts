import { resolveMapsRedirects, safeMapsUrl, type RedirectFetch } from './maps-url.js'

function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`)
}

async function rejects(run: () => Promise<unknown>, message: string) {
  try { await run() } catch { console.log(`✓ ${message}`); return }
  throw new Error(`${message}: expected rejection`)
}

const routes = new Map<string, string>([
  ['https://maps.app.goo.gl/AbCd', 'https://www.google.com/maps/search/?api=1&query=Cafe&query_place_id=ChIJabcdefghij'],
])
const fakeFetch: RedirectFetch = async url => ({
  status: routes.has(url) ? 302 : 200,
  headers: { get: name => name.toLowerCase() === 'location' ? routes.get(url) ?? null : null },
})

const resolved = await resolveMapsRedirects('https://maps.app.goo.gl/AbCd', fakeFetch)
equal(resolved, routes.get('https://maps.app.goo.gl/AbCd'), 'allowed redirect resolves')
console.log('✓ allowlisted short link resolves to a Google Maps URL')

await rejects(() => resolveMapsRedirects('https://evil.example/maps', fakeFetch), 'non-Google input is rejected')

const evilFetch: RedirectFetch = async () => ({
  status: 302,
  headers: { get: () => 'https://evil.example/collect' },
})
await rejects(
  () => resolveMapsRedirects('https://maps.app.goo.gl/AbCd', evilFetch),
  'a redirect cannot escape the Google host allowlist'
)

equal(safeMapsUrl('file:///etc/passwd'), null, 'non-http protocols are rejected')
console.log('✓ protocol and credential validation is strict')
