# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**this.is** is a social discovery platform prototype for finding and sharing places. Built with React + TypeScript + Vite on the frontend, Firebase (Firestore, Functions, Hosting, Storage) on the backend, and integrated with Google Places API (New) and OpenAI for enriched discovery.

## Development Commands

### Local Development
```bash
npm run dev              # Start Vite dev server
npm run build            # Build production bundle
npm run preview          # Preview production build locally
npm run lint             # Run ESLint
```

### Firebase Operations
```bash
# Database setup and seeding
npm run db:setup         # Initial Firebase configuration check
npm run db:seed          # Seed database with mock data
npm run db:deploy-rules  # Deploy Firestore security rules only
npm run db:deploy-indexes # Deploy Firestore indexes only
npm run db:deploy        # Deploy both rules and indexes

# Firebase deployment
npm run firebase:deploy  # Build and deploy to Firebase Hosting
npm run firebase:serve   # Serve built app locally via Firebase
```

### Cloud Functions
```bash
cd functions
npm run build            # Compile TypeScript functions
npm run build:watch      # Watch mode for development
npm run serve            # Start Firebase Functions emulator
npm run deploy           # Deploy all functions to Firebase
npm run logs             # View function logs
```

### Testing and Auditing
```bash
npm run test:maps        # Test Maps API integration
npm run test:smoke       # Run Playwright smoke tests
npm run audit:places     # Scan for Places API usage
npm run status:ui        # Screenshot UI and update snapshot
```

## Architecture

### Frontend Structure

**Pages** (`src/pages/`): Core app views including Home, Explore (card stack discovery), Search/SearchV2, Profile, ListView, PlaceHub, MapsView.

**Components** (`src/components/`): Reusable UI organized by function:
- Core components: Card, Navbar, modals (SaveModal, HubModal, ProfileModal, etc.)
- Explore components: `explore/StackCard.tsx`, `explore/StackDeck.tsx` (swipeable card discovery)
- Home components: `home/SuggestedHubCard.tsx`, rails
- Primitives: `primitives/CardShell.tsx`, `primitives/Glass.tsx`
- UI components: `ui/PlaceVisual.tsx` (Places photo display with budget control), `ui/Button.tsx`, `ui/SegmentedTabs.tsx`

**Contexts** (`src/contexts/`):
- `AuthContext.tsx`: Firebase Authentication wrapper, provides `currentUser`, sign in/up/out
- `ModalContext.tsx`: Global modal state (SaveModal, CreatePost modals)
- `NavigationContext.tsx`: Navigation helpers
- `FiltersContext.tsx`: Search and discovery filter state

**Services** (`src/services/`):
- `firebaseDataService.ts`: Main data access layer for all Firestore operations (users, places, lists, posts, comments, activity). Includes caching for user data and search results.
- `firebaseListService.ts`: List CRUD operations
- `firebasePostService.ts`: Post CRUD operations
- `firebaseStorageService.ts`: Firebase Storage uploads/downloads
- `aiSearchService.ts`: OpenAI-powered semantic search
- `enhancedDiscoveryService.ts`: AI-driven place discovery
- `featureFlags.ts`: Feature toggle system

**Places API Integration** (`src/lib/placesNew.ts`):
- Wrapper for Google Places API (New) v1 REST endpoints
- Cost-optimized with strict field masks: `places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name`
- Client-side localStorage caching (24h TTL)
- Functions: `searchText()`, `searchNearby()`, `autocomplete()`, `getDetails()`, `photoUrl()`
- Photo budget control to prevent excessive API costs

### Backend Architecture

**Cloud Functions** (`functions/src/`):
- `places.ts`: `/suggestPlaces` endpoint - AI-powered place suggestions with Firestore + in-memory caching (24h TTL)
- `maps.ts`: `/mapsNearby` endpoint - Map bounds-based place search with server-side caching
- `index.ts`: Function exports and routing
- `influences.ts`: User influence score calculation
- `content-enrichment.ts`: AI content enrichment
- `analytics-cleanup.ts`: Analytics data cleanup

**Caching Strategy**:
- **Server-side**: Firestore collections `placesCache/{key}` and `mapsCells/{key}` (24h TTL, written by Cloud Functions)
- **Client-side**: localStorage with normalized keys (24h TTL)
- Cache keys include query params, location (4 decimal places), types (sorted)

**API Key Management**:
- Client uses `VITE_PLACES_NEW_KEY` from `.env.local`
- Functions prefer server-side `GOOGLE_PLACES_NEW_KEY` (IP-restricted) via environment variables
- See `.env.local` for required configuration (never commit this file)

### Data Model (Firestore)

**Core Collections**:
- `users`: User profiles with subcollections (friends, following, followers, savedPlaces, savedLists, activity, comments)
- `places`: Place data from Google Places API + user-generated metadata (tags, savedCount)
- `hubs`: Curated place collections (similar to places but user-created)
- `lists`: User-created lists with subcollections (places, posts)
- `posts`: User-generated content about places/hubs with subcollections (comments)
- `tags`, `userTags`: Categorization and personality tags
- `userPreferences`: User settings and preferences
- `analytics`: Write-only analytics events
- `placesCache`, `mapsCells`: Server-written, client-read caches (24h TTL)

**Security**: `firestore.rules` includes a dev mode helper (`isDevMode()`) that allows unrestricted writes until 2030 for prototyping. Most reads are open for demo purposes. Production deployment should tighten these rules.

### Styling

- **TailwindCSS v4**: Using `@tailwindcss/postcss` plugin with `src/tailwind.css` (replaces old config-based setup)
- **Glass morphism**: Custom glass effects in `src/styles/glass.css` and `src/styles/cozy-glass.css`
- **Poster grading**: Visual depth system in `src/styles/poster-grade.css`
- **Page backgrounds**: `src/styles/page-bg.css`
- Component-level styles use Tailwind utility classes with custom CSS variables

### Key Files to Understand

- `src/App.tsx`: Main app layout, routing, global modals, context providers
- `src/firebase/config.ts`: Firebase initialization (Auth, Firestore, Storage)
- `firestore.rules`: Security rules with dev mode and collection-specific permissions
- `firebase.json`: Firebase project configuration (hosting, functions, rewrites)

## Cost Control for Google Places API

**Critical**: This app uses Google Places API (New) which has per-field pricing. The following measures are in place:

1. **Field Masks**: All API calls use minimal field masks (id, displayName, formattedAddress, primaryType, photos.name). Do NOT add fields like `location`, `types`, `atmosphere`, or premium fields without explicit approval.

2. **Photo Budget**: `src/components/ui/PlaceVisual.tsx` implements a photo budget system to limit photo API calls. Check budget before calling `photoUrl()`.

3. **No Auto-Details Calls**: Place Details calls are expensive. Only call `getDetails()` on explicit user action (e.g., tapping a place card).

4. **Caching**: Both server (Firestore) and client (localStorage) cache responses for 24h. Always check cache before making new API calls.

5. **Session Tokens**: Autocomplete uses session tokens to batch billing. Generate a new token per autocomplete session (debounce 300ms, max 3 calls per session).

See `docs/audit.md` and `README-maps.md` for detailed cost analysis and API usage guidelines.

## Feature Flags

`src/config/featureFlags.ts` (imported as `featureFlags`) controls experimental features:
- `search_v2`: Enable SearchV2 page with enhanced search
- `keep_reels_route`: Legacy Reels route (deprecated, redirects to Explore)

## Firebase Emulators

Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local` to use local emulators instead of production Firebase services. Useful for development without affecting prod data.

## Testing

- **E2E Tests**: Playwright tests in `tests/` directory (run with `npm run test:smoke`)
- **Screenshot Mode**: Add `?screenshot=true` to URL or set `localStorage.__screenshot_mode = 'true'` to use mock user data for screenshots

## Common Workflows

### Adding a New Place Source
1. Create a new service in `src/services/` or add to `src/lib/placesNew.ts`
2. Implement caching (localStorage + Firestore if server-side)
3. Use strict field masks to control costs
4. Update `firebaseDataService.ts` to integrate with existing data layer

### Creating a New Page
1. Add page component in `src/pages/`
2. Add route in `src/App.tsx` (inside `<Routes>`)
3. Update Navbar active tab logic in `App.tsx` `useEffect` hook
4. Add navigation handler in `handleTabChange()` function

### Deploying to Production
1. Ensure `.env.local` has all required keys (see `.env.local` for reference)
2. Run `npm run build` to verify build succeeds
3. Deploy functions: `cd functions && npm run deploy`
4. Deploy hosting + rules: `npm run firebase:deploy`
5. Check function logs: `cd functions && npm run logs`

### Database Changes
1. Update TypeScript types in `src/types/index.ts`
2. Modify `firebaseDataService.ts` methods as needed
3. Update `firestore.rules` if new collections/permissions needed
4. Add indexes to `firestore.indexes.json` if complex queries are added (Firestore will prompt in console)
5. Deploy rules: `npm run db:deploy-rules`
6. Deploy indexes: `npm run db:deploy-indexes`

## Important Notes

- **API Keys in .env.local**: Never commit `.env.local` or expose API keys. Server-side keys should have IP restrictions in Google Cloud Console.
- **Photo URLs**: Always use `src/components/ui/PlaceVisual.tsx` or `SafeImage.tsx` for displaying Google Places photos. Never use plain `<img>` tags with Places photo URLs to prevent 403 errors and control costs.
- **Poster Mapping**: `src/utils/posterMapping.ts` maps place types to curated poster images in `public/posters/` for fallback visuals.
- **Main Branch**: Check git status/recent commits for main branch name (may be `main` or `master`). Current branch is `hotfix/places-freeze-02`.
- **Node Version**: Cloud Functions require Node 22 (specified in `functions/package.json`).
