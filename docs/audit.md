This.is Audit — Data Model, API Usage, and Images

Summary
- Stack: React + Tailwind + Firebase (Firestore, Functions, Storage) + Places API (New)
- Focus: minimize Places costs, tighten field masks, normalize/caching, and align glass UI.

Collections
- users: top fields id, name, username, avatar, bio, location, influences, tags, createdAt. Subcollections: friends, following, activity, followers, savedPlaces, savedLists, comments.
- Estimated doc size: 1–3 KB typical. No oversized arrays observed (followers/following are subcollections).
- places: fields id, name, address, coordinates, category/primaryType, tags, savedCount, createdAt. Estimated: 1–5 KB typical. Risk: tags array growth—bounded by app UX; OK.
- lists: fields id, name, description, userId, isPublic, tags, coverImage, createdAt. Subs: places, posts. Estimated: 1–4 KB. No unbounded arrays.
- posts: fields id, hubId, userId, images[], description, tags[], likedBy[], comments are subcollection. Estimated: 2–15 KB. Watch likedBy growth; consider counts + per‑user map if it grows large.
- userPreferences: small docs (<2 KB). OK.
- tags, userTags: small docs (<1 KB). OK.
- analytics: write‑only (rules). OK.
- caches (added): placesCache, mapsCells — server‑written, client‑read. Small docs 2–20 KB.

Queries and Index Notes
- users/{id}/followers ordered by followedAt desc — single field orderBy, no composite.
- users/{id}/following ordered by followedAt desc — single field orderBy.
- lists by userId with orderBy createdAt desc (src/services/firebaseListService.ts:235) — where('userId','==',..)+orderBy('createdAt','desc') likely needs composite index.
- places ordered by savedCount desc (suggestion seed) — single orderBy.
- tags ordered by usageCount desc — single orderBy.
- ad‑hoc where('name_lowercase','==',..) in createHub duplicate guard — single equality. If combined with additional orderBy later, may need composite.

Places API (New) Calls
- functions/src/places.ts
- Route: suggestPlaces
- X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name
- Rendered fields: id, displayName.text, formattedAddress, primaryType, photos[0].name
- No Details calls per card; no Atmosphere/Contact.
- src/lib/placesNew.ts
- searchText/searchNearby
- X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name
- Rendered fields: id, displayName(.text), formattedAddress, primaryType, photos[].name
- functions/src/maps.ts (new)
- mapsNearby
- X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name
- Rendered fields: id, displayName(.text), formattedAddress, primaryType, photos[].name
- Autocomplete (src/lib/placesNew.ts): X-Goog-FieldMask: suggestions.placePrediction.placeId,suggestions.placePrediction.text

Tightening Applied
- Removed location and types from list field masks to reduce cost and payload. Use primaryType for UI categorization.
- No per‑card Details calls; Details only via explicit user actions (adapter path).

Image Usage Verification
- v1 media URLs used directly in <img>:
- src/components/HubImage.tsx — https://places.googleapis.com/v1/{photoName}/media?maxWidthPx=...
- src/components/ui/PlaceVisual.tsx — same pattern with budget.
- Other image patterns still present:
- src/components/CreatePost.tsx — URL.createObjectURL for local file previews (expected, non‑Places).
- src/services/firebaseStorageService.ts — local previews using URL.createObjectURL (non‑Places).
- src/components/SignupModal.tsx — local previews.
- src/services/google/places.ts — legacy JS SDK photo.getUrl helper exists but unused by UI; recommend remove or gate.

Caching Layer (added)
- Server (Firestore):
- functions/src/places.ts — caches suggestPlaces responses in collection placesCache/{encodedKey} for 24h.
- functions/src/maps.ts — caches mapsNearby responses in mapsCells/{encodedKey} for 24h.
- Key: {normalizedQuery|latLng(4dp)|radiusKm|typesSorted} for suggest; {cellId|types} for maps.
- Client (localStorage):
- src/lib/placesNew.ts — caches searchText/searchNearby for 24h with normalized keys.
- src/pages/MapsView.tsx — caches cell results for 24h.

Security Rules (proposed and patched)
- Read‑only caches for clients; writes only from Cloud Functions (admin SDK bypasses rules):
- match /placesCache/{key} { allow read: if true; allow write: if false; }
- match /mapsCells/{key}  { allow read: if true; allow write: if false; }

Oversized Docs and Unbounded Arrays
- No docs > 200 KB found by inspection. Potential growth vectors:
- posts.likedBy[] — consider capping or moving to per‑user subcollection if it grows very large.
- places.tags[] — user‑controlled; consider deduping and soft cap.

Checklist of Fixes
- [x] Tighten Places field masks to required minimal set.
- [x] Add Firestore + localStorage caches with 24h TTL.
- [x] Ensure images use v1 media URLs directly in <img>.
- [x] Replace direct imports of legacy services in AddressAutocomplete/SearchV2 with adapter (autocomplete tokens, debounce).
- [x] Add server mapsNearby skeleton with cost guard.
- [ ] Remove or deprecate src/services/google/places.ts to avoid legacy JS SDK drift.
- [ ] Add composite index for lists by userId + createdAt desc if Firestore prompts during QA.

