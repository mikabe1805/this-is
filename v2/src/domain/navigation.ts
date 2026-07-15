/** Focused entry and group-decision routes own their own Back action. */
export function shouldHideDock(pathname: string, search = ''): boolean {
  const focusedEntry = pathname === '/onboarding'
    || pathname === '/terms'
    || pathname === '/privacy'
    || pathname.startsWith('/gi/')
  const focusedGroupFlow = pathname === '/groups/new' || /^\/g\/[^/]+\/?$/.test(pathname)
  const placeParams = new URLSearchParams(search)
  const activePick = pathname.startsWith('/p/') && placeParams.has('pick')
  const focusedPlaceEditor = pathname.startsWith('/p/') && placeParams.get('edit') === 'details'
  return focusedEntry || focusedGroupFlow || activePick || focusedPlaceEditor
}
