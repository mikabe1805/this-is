# this.is — Roadmap & UX Improvement Plan

A research- and audit-driven plan for making this.is feel like a real, polished,
loved app that people return to — while staying cheap to run. Generated from a
full-codebase audit (every flow) plus research on what drives retention and
"feel" in place-discovery apps (Beli, Foursquare/Swarm, Google Maps lists,
Pinterest, Atlas Obscura).

## North star

> Stop treating a "save" as a dead-end pile (the Google Maps Lists failure mode)
> and turn it into an active loop: every save sharpens a personal taste signal,
> every save your friends make shows up as on-card social proof and a free
> activity notification, and the home feed visibly changes between visits. The
> app should feel native — instant optimistic taps with haptics, page-shaped
> skeletons instead of "Loading…" flashes, scroll preserved on back. Crucially,
> almost all of this is built from **internal Firestore data** so it deepens
> engagement without touching the per-field-priced Google Places bill.

---

## ✅ Shipped in this pass (June 2026)

**Critical bug fixes**
- `/maps` now works — fixed the Google Maps JS async-load race (loader resolved
  before `google.maps` initialized) and added a `gm_authFailure` handler so a
  rejected key shows a clean error instead of Google's gray overlay.
- `getSavedPlaces` was filtering an array of *pending promises* (never null) —
  saved places / Favorites / Home count were returning corrupted data. Now
  awaits, then filters, and caps the N+1 fan-out at 200.
- Implemented the missing `getPostsForHub` (referenced but undefined — threw on
  every hub-banner refresh).

**Trust / correctness**
- Signup no longer dead-ends when a user types a city without picking a
  suggestion (autocomplete now commits free-text on blur/Enter).
- Home bookmarks reflect already-saved places (savedIds seeded + updated on save).
- Profile list ❤️ now reflects *likes* (was reading the bookmark set — backwards).
- PlaceHub like count is correct & flicker-free (proper optimistic math).
- Messages inbox is now a live `onSnapshot` subscription (no more stale list).
- Embed posts attach to lists atomically (was a non-atomic loop that lost
  associations on partial failure).
- Save flow: replaced the blocking `window.confirm` with a non-blocking
  "Updated/Saved" toast; "Create & Save" keeps your input on failure.
- `setupViewportHandler` always returns a cleanup fn.

**Feel / polish**
- A single **motion language** (`--dur-*`, `--ease-*` tokens); real press-scale
  feedback (`.press`); reduced-motion no longer kills tap feedback.
- **Haptics** (`src/utils/haptics.ts`) wired to the central Plus button and all
  toast confirmations, gated on the Settings toggle + `prefers-reduced-motion`.
- Page-shaped **skeletons** for code-split routes (no more "Loading…" flash) +
  a reusable `.skeleton` shimmer.
- **Scroll restoration** on back-navigation (`useScrollRestoration`).
- Reusable **`EmptyState`** component (deployed on Favorites; ready for more).
- **Toast**: stacks, rises in, sits clear of the dock, error/success haptics.
- Navbar tabs hit 44px targets + visible focus rings.
- Bumped `--ink-mute` to clear WCAG AA contrast on paper.

**Cost**
- Service worker now **bypasses paid/live endpoints** (Places, Maps, Firestore,
  auth) so it never double-caches paid responses or stale data (cache bumped v2).
- Photos bill on the **dedicated Places key only** (was falling back to the Maps
  key, outside budget controls) — degrades to poster if unset.
- **Photo budget is idempotent** per URL (was double-counting on re-render).
- Autocomplete session cap raised 3→8 (was silently killing the dropdown).

**Retention**
- On-card **social proof** (`N saves`) now flows to the home feed (zero new cost).
- **Post-signup welcome** toast drops new users into the discovery loop.

**PWA**
- Consistent theme color, maskable icon purpose, and app shortcuts
  (Discover / Search / Favorites).

---

## ✅ Shipped in pass 2 — the recommendation overhaul + core fixes (June 2026)

**A real taste engine** (the centerpiece). `buildTasteProfile(userId)` now learns
who you are from the categories of places you've actually **saved** (weighted
highest), your signup vibes, and your bio — mapped onto a 28-interest lexicon
(`placeTypes.ts`) covering coffee, brunch, beaches, hikes, bars, bookstores,
ramen, rooftops, etc. `getTasteRecommendations()` then queries Google with
vibe-rich phrases ("cozy specialty coffee shop", "scenic beach") near you,
blends in taste-ranked internal places, drops what you've already saved, ranks
by taste-fit + proximity + popularity, and attaches a **"Because you love …"
reason** shown on every Home card. Cost-bounded: ≤4 `searchText` calls per load,
cached per interest|vibe|~1km cell for 24h; profile cached 5 min and invalidated
on save. New saves visibly reshape the feed.

**Chat fixed.** Added the missing `threads` composite index (participants
array-contains + lastMessageAt desc) — the blocker for the inbox; new threads
seed `lastMessageAt` so they appear immediately; send/subscribe errors now log
Firestore error codes and no longer blank the conversation. ⚠️ **Deploy the
index:** `npm run db:deploy-indexes` (chat inbox stays empty until this runs).

**List-map pins fixed.** Root cause: Google places carry coords at top level
(`p.lat/p.lng`) but the save path only read `p.coordinates`/`p.location`, so
coords never persisted. Now uses `readCoords` (handles every shape) on the Home
& Search save paths, plus a bounded, write-back **self-healing backfill**
(`backfillMissingCoords`, ≤8 `getDetails` per list view) so already-saved
coordless places heal over time.

**Search ranking fixed.** `searchUsers` now ranks by name/handle relevance
(exact → prefix → substring → bio/tag), not raw influence; Search reorders
sections so **People come first** when the query looks like a person (or starts
with `@`).

---

## ✅ Shipped in pass 3 — "the app is getting to know you" (June 2026)

The goal: make the app feel like it's making a real effort to learn who you are,
so it feels different user-to-user and deepens with use — with infrastructure
that makes that *literally* true, not cosmetic.

**A persistent, accumulating taste model.** New `userTaste/{uid}` document holds
a durable interest→score vector (+ vibes, + `signalCount`, + suppressed places),
updated via **atomic Firestore increments** so it survives sessions and compounds
forever. `recordTasteSignal` is the write half of the learning loop.

**Every interaction now teaches it**, weighted by intent:
- **Save** — loved (×3) ≫ tried (×2) > want (×1.5) — strongest signal.
- **Open a place** (×0.6) and **like a post** (×1) — even browsing teaches it.
- **Search** (×0.5) — what you look for is intent.
- **"Not interested"** (×−2 + suppressed) — a thumbs-down on any feed card that
  visibly tunes the feed and never resurfaces that place.

`buildTasteProfile` blends the accumulated vector (primary) with saved-place
categories + signup vibes + bio, so it works on day one and sharpens with use.

**Made it felt:**
- Home's For-You header now reads **"Tuned to your love of coffee, beaches &
  bookstores"** with a confidence eyebrow that climbs from *Getting to know you*
  → *Learning your taste* → *Tuned to you* as `signalCount` grows.
- A **"Your taste" card** on your profile — the receipt: a getting-to-know-you
  meter that fills with use, your top interests as chips, and your vibe.
- Per-card **"Because you love …"** reasons (pass 2) make each pick feel chosen.
- All of it is genuinely different per user and improves the more you use the app.

---

## ✅ Shipped in pass 4 — deploy, vibe, maps, create-post, social (June 2026)

- **Deployed** Firestore rules + indexes to `this-is-76332` (the chat composite
  index is live → inbox works; `userTaste` rule live).
- **Vibe overhaul (Pinterest-worthy, Gen-Z).** Replaced the 10-word millennial
  vibe list with a 27-entry aesthetic lexicon (sun-drenched · matcha hour ·
  cottagecore · dark academia · gorpcore · golden hour · hidden gem …). Vibes
  are now derived from the *categories + tags + names* of places you engage with
  and **accumulate over time**, so "Your vibe" reads like a growing mood-board
  caption (up to 7 words) instead of one adjective. Signup vibe chips updated to
  match.
- **List-map pins — legacy data now self-heals.** Extended `backfillMissingCoords`
  with a name+address `searchText` fallback (heals saves that predate the
  `googlePlaceId` field, no data wipe needed) and fixed the seed script to
  populate `list.hubs` (seeded lists were returning zero places).
- **Create-post flow optimized.** Consolidated the two duplicate CreatePost
  instances into one (ModalContext-owned); added a submit guard + "Posting…"
  state (no double-posts); client-side image type/size validation + a 5-photo
  cap with feedback; **fixed a silent-failure bug** (createPost returns null on
  failure — the old code closed the modal as if it succeeded); specific error
  toasts + a "View" action; haptics; honest screenshot hint; a11y label.
- **Friend-taste blending.** Recommendations now fold in places people you
  follow have saved, boosted and labeled **"Maya saved this"** / "Maya + 2 you
  follow saved this" — trusted-taste social proof in the feed (bounded to 12
  follows, cached 10 min).

---

## ✅ Shipped in pass 5 — lanes, social sharing, evolving taste (June 2026)

- **Named taste lanes.** Home now shows themed horizontal rows below For-You —
  "More coffee you'll love", "Beaches for your next trip" — one per top
  interest. `getTasteLanes` reuses the same per-interest searchText cache the
  feed already warmed, so it adds ~no Google cost; lanes exclude what's in the
  grid so they show *more*, not repeats.
- **Send to a friend (in-app DM share).** ShareModal's "Send to friend" opens a
  friend picker (people you follow + friends) that opens/reuses the 1:1 thread
  and seeds it with the place link — the direct sharing path, built on the
  now-working messaging layer. Triggerable app-wide via a `this-is:send-to-friend`
  event.
- **Taste time-decay.** The accumulated taste vector now fades ~15% every 2
  weeks (dropping dust), so the profile tracks *evolving* taste — interests you
  still engage with stay strong, abandoned ones quietly recede.

---

## ✅ Shipped in pass 6 — verified journey audit: correctness, iOS-feel, dead-code (June 2026)

Driven by a ~20-agent trace-and-adversarially-verify audit of every live journey
(65 confirmed findings). Landed the high-value, low-risk set; `tsc` baseline diff
shows **0 new type errors** (net −20 from deleted dead code) and `npm run build`
is green.

**Core correctness**
- **Taste model no longer self-corrupts.** `detectInterests`/`detectVibes`
  (`placeTypes.ts`) matched short keywords as substrings of place *names*
  ("Embarcadero"→bar, "Cartwright"→art, "iPhone"→pho, "parking"→park), writing
  phantom interests into the persistent `userTaste` vector. Now tokenizes and
  requires whole-token matches for ≤4-char keywords (substring kept for longer /
  multi-word). Diacritics stripped so "café"→coffee still hits.
- **Failed saves no longer show "Saved".** `savePlaceToList` swallowed write
  errors → the bookmark flipped + `savedCount` bumped + success toast fired even
  when nothing landed. Now rethrows; callers show the real error.
- **People search isn't truncated to the top-50 most-influential** before name
  matching (most users were unfindable). Fetches a wider unordered pool, ranks
  client-side, keeps influence as a tiebreaker.
- **UserProfile list-like double-counted influence (+15 vs +5)** via a stray
  `saveList` call — removed (matches Profile.tsx). Like/follow are now optimistic;
  Followers count is fetched live (`getFollowerCount` via `getCountFromServer`)
  instead of the always-0 `followersCount` field.
- **PlaceHub comments modal** now fetches the real subcollection on tap (was
  reading the usually-empty embedded array).
- **Own-profile saves** now teach the taste model + dispatch `this-is:saved`
  (TasteCard refreshes), matching the global save path.
- **ListView**: the dead header Share button is wired (native share / copy);
  the bespoke save path now saves to **all** picked lists and runs the global
  pipeline (mirror, taste signal, event, toast) instead of dropping them.
- **/maps** self-heals coord-less legacy saves (`backfillMissingCoords`, mirrors
  ListView) so they stop vanishing from the map.
- **Route crashes no longer wipe the shell**: a keyed `ErrorBoundary` around the
  routes resets on navigation and keeps the Navbar alive so the user can escape.

**The save→smarter-feed loop is finally legible**
- Home now optimistically drops a saved card and debounce-re-ranks the For-You
  grid (no Places cost — reuses the 24h cache); dismiss backfills from a spare
  pool so the grid never shrinks; empty-state copy stops blaming location when
  location is known. Ranking: sublinear (sqrt) interest weighting so one category
  can't run away; popularity prior scored per-pool; Refresh reshuffles even in
  low-density areas; **lanes now source from interests *beyond* the grid's top-4**
  so they add breadth instead of echoing it.

**iOS-native feel (for the upcoming wrapper launch)**
- **Haptics now have an iOS path**: `haptics.ts` posts to a
  `window.webkit.messageHandlers.haptic` bridge (→ `UIImpactFeedbackGenerator`)
  when present, falling back to `navigator.vibrate` on Android. ⚠️ The native
  shell must register that handler for buzz on iOS. Wired across Home, Search,
  Explore, PlaceHub, profiles, message send, tab switches.
- **Optimistic message send** (instant bubble, duplicate-safe id reconciliation);
  composer respects the home-indicator safe area; chat/inbox timestamps are now
  relative ("5m"/"3h") / clock-with-day instead of a full year-date.
- **Top safe-area** (`.safe-top`) on every sticky header (was notch-clipped);
  Navbar hidden inside a chat thread so the composer owns the bottom edge.
- Sub-44px tap targets fixed (Explore filter pills, Home refresh); Search input
  gets the iOS "Search" key + no autocapitalize/autocorrect; case-insensitive
  recents; avatar broken-image fallbacks; TasteCard meter no longer shows 6% at
  zero signal.

**Cost / cleanup**
- Search Google fallback no longer fires a billable Text Search on 1–2 char
  queries; `useSearch` skips its 4-read context build when the AI path is off.
- Deleted dead `discoveryAlgorithm.ts` (613 LOC), the discovery half of
  `intelligentSearchService.ts`, and the unused `explore/StackDeck`/`StackCard`
  + `explore_stacks` flag.

**Pass 6 (cont.) — feed photos, search posts, hardening**
- **Real photos in discovery feeds.** Home/Explore/Search rendered a generic
  risograph poster for every external place (the `photos.name` we already pay for
  was discarded). Now eager-loads real Google photos for the first ~6
  above-the-fold cards (lanes: 4), posters below — bounding the Photo-SKU cost.
  Also made `HubImage` respect the global `PLACES_PHOTOS_ENABLED` kill-switch (it
  was loading photos whenever the key existed, ignoring the flag — now
  authoritative everywhere: feeds, hub/list modals, ListView).
- **Search now renders matching Posts** (post-text was fetched and discarded, so a
  query matching only a post showed "No matches"); skeleton→results cross-fade.
- **AI-search launch hardening.** Browser-side OpenAI (`dangerouslyAllowBrowser`)
  now requires an explicit `VITE_OPENAI_ALLOW_BROWSER=true` opt-in, not just the
  key's presence — a stray `VITE_OPENAI_API_KEY` can no longer silently ship the
  key in the bundle + bill per search.
- **Inbox** literal "Loading…" → page-shaped skeleton rows.
- **`userTaste.suppressed` can't grow unbounded** toward the 1MB doc limit:
  dismissals now store a timestamp and the decay pass prunes entries past a 90-day
  TTL (dismissed places can eventually resurface).
- **Influence 0-state** now reads "Influence grows from likes & saves on your
  lists · updates daily" instead of a bare, broken-looking 0.

---

## ✅ Shipped in pass 7 — unread DMs, chat keyboard, map callout, cold-start (June 2026)

Previously-deferred items. `tsc` baseline diff: 0 new errors; build green.

- **Unread message state + badge.** Threads now carry a per-participant `reads`
  map; the inbox bolds unread rows + shows an accent dot, and a live dot appears
  on the bottom-nav profile tab (`subscribeUnreadCount`, no user-hydration).
  Opening a thread (or receiving while open) stamps `reads.<uid>` and clears it in
  real time. No rules change needed — the existing participant `update` permission
  covers it. (Pure Firestore; the foundation for the App Badge API later.)
- **Chat keyboard-inset.** The composer now lifts above the iOS soft keyboard via
  a `visualViewport` listener (dvh doesn't shrink for the keyboard; visualViewport
  does) — a no-op on desktop / when closed. ⚠️ Verify on a real device.
- **In-place map pin callout.** Tapping a pin on `/maps` now shows a
  `MapCalloutCard` (name/address/thumbnail + Open/Close) that keeps the map's
  pan/zoom, instead of hard-navigating away. Added an optional `onOpen` to the
  card (backward-compatible with ListView's usage).
- **Cold-start: Following.** Replaced the bare `Loading...` (which wiped the whole
  page) with in-page skeleton rows; swapped the CTA-less empty states for the
  `EmptyState` component (with "Find people" → Search); 44px filter pills + tab
  haptics; avatar broken-image fallback; follow/unfollow haptics; safe-area header.
- **Glass fallback.** Added an `@supports not (backdrop-filter)` block so glass
  surfaces (dock, CTAs, chips, cards, badges) become near-opaque solids where blur
  is unsupported — content can no longer bleed through and kill legibility.

---

## ✅ Shipped in pass 8 — the Beli loop (pairwise ranking on save) (June 2026)

The single highest-leverage retention mechanic for a place app, per the research.
Zero Google Places cost — pure Firestore on a new `userRankings/{uid}` doc.

- **`rankingService.ts`** — maps a save's status/tried-rating to a sentiment
  bucket (`liked` / `fine` / `disliked`; `want` = wishlist, not ranked),
  binary-inserts the place into that bucket's ordered list, and derives a
  **0–10 score** from its position within Beli-style score bands (liked
  6.8–10, fine 3.4–6.7, disliked 1–3.3). Scores recompute on every insert.
- **`RankFlowModal.tsx`** — a skippable bottom sheet that asks "which did you
  prefer?" (new place vs the current binary-search pivot), ~log₂(n) comparisons,
  then reveals the score ("Ranked #3 of 12 of your liked places"). Skipping still
  places it at the best estimate, so it's never a dead end. Opened by a
  `this-is:rank-place` event.
- **Trigger** — the post-save toast offers **"Rank it"** for experienced saves
  (loved / tried) across all save paths (global SaveModal, PlaceHub, ListView,
  Profile). Non-blocking — coexists with the cover-photo picker.
- **Display** — PlaceHub shows the viewer's personal score as a badge under the
  title, updated live when they (re)rank.
- **Rules** — added a `userRankings/{uid}` owner-write rule (⚠️ run
  `npm run db:deploy-rules`; the collection is denied without it).

---

## 🎯 Next up — high impact, low/medium effort

### Sharing experiences & trips with friends
- **Send to a friend (in-app DM share).** Now that chat works, add a "Send to a
  friend" action in ShareModal + on places/lists: a friend picker →
  getOrCreateThread → seed a message with the place/list card. Turns the social
  graph + DMs into the primary sharing path the vision calls for. (The existing
  primitives — posts as experiences, lists as trips, the friends activity feed —
  already cover passive sharing; this adds direct, intentional sharing.)
- **Trip mode for lists.** Let a list carry dates + an ordered itinerary and a
  cover, so "share my weekend in Lisbon" is one tap. Friends can react/comment.

### Recommendation engine — next iterations
- **Debounce / batch taste writes.** `recordTasteFromPlace` fires one Firestore
  write per place-open; batch or debounce (e.g. flush once per session, or only
  write opens after a dwell threshold) to cut write volume on heavy browsing.
- **Denormalize saved-place types** onto `users/{uid}/savedPlaces` at save time
  so `buildTasteProfile` doesn't N+1 `getPlace` for every saved place.
- **Send-to-friend from lists too.** Wire the same `this-is:send-to-friend`
  event from ListView so trips (lists) are one-tap shareable, not just places.
- **AI taste summary (optional).** Replace the keyword bio analyzer with a
  cached one-shot OpenAI call that extracts richer interests/vibes from bio +
  saved-place names (cache on the user doc; one call per profile change).

### Retention
- **Pairwise ranking on save (the Beli loop).** After a save, optionally ask
  1–2 "Better or worse than [place]?" comparisons → a personal 0–10 score and a
  ranked list per category. Skippable so it never blocks the save. *Zero Places
  cost — pure Firestore on existing `savedPlaces`.* This is the single highest-
  leverage retention mechanic for a place app.
- **Friend-scoped social proof.** Extend the on-card chip to "Maya + 2 you follow
  saved this". Needs a `savedBy[]` (capped) array on place docs, intersected with
  the already-loaded following list. *Near-zero cost.*
- **Vibe-onboarding → instant first recommendation.** The signup vibe step
  already writes `userTags`; close the loop by showing ONE tailored rec
  immediately and seed-ranking 3–5 places they already love. Solves cold-start
  before the social graph exists.
- **Resurface saves so the list isn't a graveyard.** A "Plan" grouping, a "you +
  Maya both saved this" badge, periodic resurfacing of older saves in the feed.

### Feel / polish (remaining)
- Forward/back **screen transitions** for detail routes (View Transitions API)
  so `/place/:id`, `/list/:id` slide/cross-fade instead of hard-cutting.
- Deploy `EmptyState` across the remaining cold-start surfaces (Following, empty
  Search, empty Explore tabs, ListView, Home "Friends").
- Photo **loading shimmer** + fade between poster and photo in feeds.
- Migrate components off the legacy sage/linen/charcoal alias layer onto the
  canonical tokens; delete aliases as call-sites convert.
- `@supports (backdrop-filter)` fallback so glass surfaces stay legible where
  blur is unsupported.

### Cost (bigger levers, need careful testing)
- **Make the Firestore `places` collection the source of truth.** On any
  `searchText`/`searchNearby`/`getDetails` result, upsert the full place into
  `places/{id}` with a `fetchedAt` stamp; on later lookups resolve known IDs
  from Firestore first, only calling Google for missing/stale IDs. Converts the
  2nd–Nth view of any place from a ~$32/1k Nearby + ~$7/1k Photo into a
  ~$0.06/100k Firestore read. **Caveat:** writing on every *search* (not just
  save) adds write cost; gate it (e.g. only upsert places the user interacts
  with) so heavy searchers don't invert the savings.
- **Static Maps for read-only map surfaces.** Render the hub mini-map and
  ListMap preview as Static Maps images (~70% cheaper per surface); load the
  interactive JS map only on `/maps` or an explicit "open map" tap.
- **Set hard Google Cloud billing budgets + per-SKU daily quotas** (Nearby,
  Photo, Details). The safety net behind the app-level budgets — prevents a bug
  or abuse from running an unbounded bill. *No code; Cloud Console config.*
- **Global, server-backed photo budget** (Firestore counter or Functions gate)
  instead of per-browser localStorage, and cache resolved photo bytes in Storage
  so a popular place's photo is bought once, not once per viewer.
- **Denormalize feed/activity hydration + paginate.** Embed a
  `{name, photoResourceName, primaryType}` snapshot on activity/post/savedList
  docs at write time so feed reads are one query instead of an N-doc fan-out
  (a 50-item feed can be 100+ reads today). Add cursor pagination everywhere.
- **Cache OpenAI enrichment per doc** (generate hub descriptions / semantic
  expansions once, not per view) and prefer a cheaper model for routine work.

---

## 🔭 Longer-term bets

- **Place catalog as a denormalized entity store** (quarter+): commit fully to
  the Beli/Foursquare/Maps pattern — `places/{id}` is a shared server-side
  catalog fetched from Google once per place; per-user data (saves, status,
  notes, scores) lives separately and is joined client-side. The backbone that
  makes both ranking and the cost model work at scale.
- **Transparent weighted-linear recommendation engine** (months): a tunable
  linear score over cheap features (tag overlap, friend-saved count, savedCount,
  distance-from-fetch-cell, recency, time-of-day), client-side or in
  `suggestPlaces`. Explicitly NOT collaborative-filtering/ML — needless cost and
  opacity at this scale.
- **Named-lane feed with a wildcard slot** (months): interleave Nearby /
  Friends-saved / Popular-this-week / Matches-your-tags lanes, every 4th card a
  deliberate wildcard, with a "new since you were here" marker so the feed
  visibly changes between sessions. Lanes are individually cacheable.
- **Web push via FCM** (high effort): `firebase-messaging-sw.js` + VAPID,
  register the token behind the (currently dead) Settings toggle, trigger
  personalized pushes from Firestore triggers — "X you follow saved [place]",
  new message, gentle weekly "finish your list". Cap 3–5/week, quiet-hours
  aware; on iOS only request once the PWA is installed. *FCM web push is free.*
- **Forgiving WEEKLY momentum + friends-scoped status** (months): a weekly
  momentum indicator (with freeze/grace days) and a light friends-scoped
  leaderboard. Never a daily streak — a place app is low-frequency, so daily
  counters punish normal behavior.
- **Opt-in "Quick picks" swipe mode** (months): resurrect the existing StackDeck
  (behind `explore_stacks`) as a Tinder-for-places mode where each swipe is a
  labeled taste signal — solves cold-start AND adds fun, while the scroll grid
  stays the default.
- **Full PWA "real-app" shell** (months): richer install dialog (screenshots),
  App Badge API for unread DMs, multi-strategy SW (cache-first shell + SWR for
  thumbnails), "new version — tap to refresh" toast, branded offline page,
  proper padded maskable icon asset.
- **Editorial curated lists as feed entry points** (weeks): a few hand-curated
  themed lists ("Where locals actually go in {city}", "Rainy-day picks") for
  Atlas-Obscura-style warmth.
- **Dense single-city launch** to solve cold start, with optional contact-import
  / friend-of-friend seeding.

---

## 🔒 Pre-launch obligations (not optional)

- **Tighten Firestore security rules.** `firestore.rules` currently has a dev
  helper allowing unrestricted writes until 2030 and `allow read: if true` on
  sensitive collections. Require auth for `savedPlaces`/`friends`/`followers`/
  `comments`; keep only `lists` and public `posts` world-readable.
- **Restrict & quota the client API keys.** `VITE_*` keys ship in the bundle by
  design — keep tight HTTP-referrer/IP restrictions and per-SKU quotas; longer
  term, proxy photo/media through a Cloud Function.
- **Confirm composite indexes** exist for `searchUsers`/`searchPosts` and the
  threads inbox query, or they fail silently in production.
- **Define activation instrumentation**: the "aha" event, time-to-first-value,
  week-1 retention, using the existing `analytics` collection.

---

## Known minor cleanups (low priority)

- Remove dead `CommentsModal.tsx` (PostModal renders comments inline).
- `intelligentSearchService` / `discoveryAlgorithm` appear unused by the live
  flow — wire in or remove; fix the `likedPosts→likedLists` field mapping if
  reused.
- Standardize comment timestamps on `toISOString()` (postComment vs
  postProfileComment differ).
- De-dupe the two `CreatePost` modal instances (App.tsx vs GlobalModals).
- Embed extraction: surface `embedPreview.error` and add a ~10s timeout.
- Pre-upload image size warning (>5MB) in CreatePost.
