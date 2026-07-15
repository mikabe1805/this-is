export interface RedirectResponse {
  status: number
  headers: { get(name: string): string | null }
}

export type RedirectFetch = (url: string) => Promise<RedirectResponse>

function allowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'google.com'
    || host.endsWith('.google.com')
    || host === 'maps.app.goo.gl'
    || host === 'goo.gl'
}

export function safeMapsUrl(value: string): URL | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password || !allowedHost(url.hostname)) return null
    if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps')) return null
    return url
  } catch {
    return null
  }
}

export function isShortMapsUrl(url: URL): boolean {
  return url.hostname === 'maps.app.goo.gl'
    || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps'))
}

/** Follow only explicit HTTP redirects and revalidate every hop. The fetcher
 * uses redirect:manual, so DNS or HTTP redirects can never escape the allowlist. */
export async function resolveMapsRedirects(
  input: string,
  fetchRedirect: RedirectFetch,
  maxHops = 8
): Promise<string> {
  let current = safeMapsUrl(input)
  if (!current || !isShortMapsUrl(current)) throw new Error('invalid-maps-link')

  for (let hop = 0; hop < maxHops; hop += 1) {
    const response = await fetchRedirect(current.toString())
    if (response.status < 300 || response.status >= 400) {
      if (isShortMapsUrl(current)) throw new Error('unresolved-maps-link')
      return current.toString()
    }
    const location = response.headers.get('location')
    if (!location) throw new Error('missing-redirect')
    const next = safeMapsUrl(new URL(location, current).toString())
    if (!next) throw new Error('unsafe-redirect')
    current = next
  }
  throw new Error('too-many-redirects')
}
