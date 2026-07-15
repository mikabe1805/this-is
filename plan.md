# Plan: Restore Google Hub Suggestions & Search Stability

> **Archived v1 incident plan.** The canonical v2 has no Home hub-suggestion feed. Keep this only as historical Places-cost and failure-analysis context. Current work is tracked in [`docs/product-reset/CURRENT_STATE.md`](docs/product-reset/CURRENT_STATE.md).

## Goals
- Restore the Google hub suggestions so that successive refreshes surface genuinely new, high-quality places within the configured radius (up to 50 miles) without re-serving stale results.
- Fix search fallout introduced by recent Places changes and ensure Firestore queries no longer trigger `view`-related assertion errors.
- Keep API usage/latency in check; cache when possible while still allowing a true refresh path.

## Current Observations
- Refresh now calls Places without throwing, but results often recycle nearby entries (~1 mile) and the seen-filtering logic may reintroduce items because caches persist in sessionStorage.
- Search now throws a Firestore internal assertion (likely due to conflicting listeners or missing target metadata) after the latest edits.
- The Places wrapper jitter is small (80m) and includedTypes fallback is static, so bypassed calls can still land on a similar set if Google ranks nearby chains highest.

### New Findings (code audit)
- Radius clamp mismatch: external search caps radius at 50 km even when UI asks for 50 miles (80 km). See `src/services/firebaseDataService.ts:2329` (assigns `radiusMeters = Math.min(queryRadiusKm * 1000, 50000)`). This prevents wider refreshes.
- Forced-refresh seen-set not cleared due to a quoting bug: `sessionStorage.removeItem(''suggested_seen_ids'')` uses double single-quotes, so the key is never removed. See `src/pages/Home.tsx:315` vicinity. This keeps older IDs sticky and reduces diversity.
- Included types rotation exists (via `suggested_refresh_counter`) and jitter already increases on bypass, but jitter cap is up to 2 km while radius may be 80 km. Might be okay, but we can tune to 0.5–1.0 km for urban areas and 2–4 km for suburban/rural.
- External radius on forced refresh in Home is set to 80 km (50 mi), but the service layer clamps to 50 km (see above), causing fewer unique candidates than expected even with bypass.
- `loadSuggested` builds a good composite de-dupe key (name|address and coordinates) and filters against `forYou` and DB `existingLite`, plus a per-session seen-set. Once the seen-set bug is fixed, variety should increase further.

## Approach
1. **Audit latest changes**
   - Compare `getExternalSuggestedPlaces` and `loadSuggested` against the last known-good version to understand the regression points (cache bypass logic, seen-set handling, sessionStorage keys).
   - Check for leftover sessionStorage entries when `force` is true; ensure we purge the key and not just the in-memory cache.
   - Confirm distance filtering still honors the full `radiusKm` and isn’t overridden elsewhere.

2. **Improve refresh diversity**
   - Expand `includedTypes` rotation on forced refresh: derive a prioritized list (user interests, default set, add complementary types like `tourist_attraction`, `bar`, `museum`). Rotate in a deterministic-yet-varied way each refresh.
   - Increase jitter radius (e.g., 500–800 m) when bypassing cache, but clamp to avoid exceeding radius.
   - Make sure we dedupe against historical suggestions by tracking `suggested_seen_ids` per location & radius; on forced refresh we should optionally prune very old entries beyond 24h to allow resurfacing after some time.

3. **Review caching pipeline**
   - Ensure `sessionStorage` removal occurs prior to new results writing back to the same key; consider tagging cache entries with version + timestamp to detect stale writes.
   - Log the applied radius and distance filtering decisions to confirm we aren’t cutting items >1 mile prematurely.

4. **Fix Firestore assertion (search)**
   - Reproduce search flow with the current code path; inspect `firebaseDataService.performSearch` for listeners or snapshot handling that may have changed.
   - The stack trace points to watch stream remote key retrieval; likely due to `listen`/`unlisten` mismatch or misuse of `getDocs` with active listeners. Trace any global caches or watchers added recently.
   - Add guarded error handling around Firestore queries; fall back gracefully and log root causes.

5. **Regression testing**
   - Manual: multiple refresh clicks, confirm variety across 5+ attempts, verify distances extend to configured radius.
   - Search: run multiple queries (hot and cold) and ensure no Firestore errors; verify UI still shows results.
   - Lint/build.

6. **Documentation / cleanup**
   - Summarize changes in this plan once executed (for reference) and remove redundant console logs if they clutter DevTools.

## Resources / References
- Last known working commits for `loadSuggested` & `firebaseDataService.getExternalSuggestedPlaces` (check git history pre-refresh changes).
- Firestore best practices for one-off searches vs live listeners (Firestore docs).

---

## Implementation Checklist (next PR)

1) Fix sessionStorage seen-set reset and TTL
- Correct the key removal bug on forced refresh:
  - Change to `sessionStorage.removeItem('suggested_seen_ids')`.
  - File: `src/pages/Home.tsx:315` (in `loadSuggested(bypassCache)` block).
- Add TTL to the seen set (24h):
  - On read: if `Date.now() - stored.ts > 24h`, drop it.
  - On write: store `{ ids, ts }` instead of a bare array.
  - Files: `src/pages/Home.tsx:110–120` (seen-set init) and the write path around `src/pages/Home.tsx:392–404` where we assemble `arr` and set sessionStorage.

2) Allow up to 50 miles radius
- Increase external Places cap from 50 km to 80 km (50 mi):
  - Change `radiusMeters = Math.min(queryRadiusKm * 1000, 50000)` to `Math.min(queryRadiusKm * 1000, 80000)`.
  - File: `src/services/firebaseDataService.ts:2329`.
- Keep default user preference translation: miles → km already handled in `Home.tsx`.

3) Tune jitter + type rotation on forced refresh
- Keep existing rotation via `suggested_refresh_counter` but ensure urban/rural aware jitter:
  - Urban (radius ≤ 20 km): cap jitter to 500–800 m.
  - Suburban/rural (radius > 20 km): cap jitter to 2–4 km.
  - File: `src/services/firebaseDataService.ts:2331–2356` (searchNearby options assembly).
- Add a small per-refresh offset to ordering to avoid repeated top-ranked chains.

4) Cache keys and versioning
- Confirm the cache key includes lat/lng (rounded), `openNow`, and effective radius (it does: `cacheKey` in `Home.tsx:308–313`).
- Add a simple version suffix (e.g., `v2`) to avoid reading older shapes after this patch.

5) Search stability guardrails
- `performSearch` already uses `getDocs` (no live listeners). Add structured error logging with `code`, `message`, and query params to identify failing collections quickly.
  - File: `src/services/firebaseDataService.ts:869–903` (try/catch around the parallel queries) and in each `search*` method header.
- Validate composite index requirements: queries with `where('tags','array-contains-any', tags)` plus `orderBy` can require an index. Confirm indexes are present or drop the `orderBy` when text query exists (already handled for places/lists).
- Add a protective circuit breaker to avoid firing all four queries when the user types fast (debounce is 600ms; we can cancel in-flight by renting an AbortController or by ignoring stale results via a request id).

6) Acceptance criteria
- Suggestions refresh (forced):
  - At least 8 of 12 are new vs the last forced refresh (tracked by `suggested_seen_ids`).
  - Median distance increases to reflect the configured radius when applicable (not clustered within 1–2 km unless radius is small).
- Suggestions (cold load):
  - Use cache if present and under 2 minutes old; bypass respects `openNow` and radius changes.
- Search:
  - No Firestore assertion errors across 20 rapid queries; results render or an inline error shows without breaking the route.

7) Instrumentation
- Add concise `console.info` logs when applying radius/jitter and when dedupe removes candidates. Remove or lower noisy logs post-verify.

8) Follow-up (nice-to-have)
- Persist `suggested_seen_ids` per `(latRounded, lngRounded, radiusBucket)` to avoid cross-city suppression.
- Consider excluding known chain brands with a short blocklist when variety is still low.

## File-Level To-Dos
- `src/pages/Home.tsx:110–120` load seen-set with TTL handling and versioning.
- `src/pages/Home.tsx:308–340` fix removeItem bug; add cache key version; ensure `bypassCache` clears both cache and seen-set correctly.
- `src/pages/Home.tsx:392–404` persist seen-set as `{ ids, ts }`.
- `src/services/firebaseDataService.ts:2325–2365` raise radius cap to 80 km; tune `jitterMeters`; keep includedTypes rotation logic.
