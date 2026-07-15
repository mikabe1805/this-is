# MAKEOVER.md — this.is v2: the full reimagining

> **Superseded product direction.** This document preserves the July 2026 personal-board/EMBERBOARD proposal for research history. It is not implementation authority. The current thesis and canonical implementation are [`docs/product-reset/THIS_IS_RESET.md`](docs/product-reset/THIS_IS_RESET.md) and [`v2/`](v2/).

*Prepared July 2026. Built from a 10-agent code audit + 3 external research sweeps, then a
4-design panel judged by 3 adversarial judges and synthesized into one buildable spec.*

**Confidence markers:** ✅ verified (measured in this repo, or a checked primary source) ·
◑ sourced-unconfirmed (credible source, not independently verified) · 💡 design synthesis
(a judgment this document makes) · ⚠️ general knowledge (unverified background).

---

## TLDR

The app's problems are not bugs to fix — they are architecture. Every complaint traces to a
structural cause: an 8–15s cold load produced by a self-serializing request queue and ~400–2,000
N+1 Firestore reads per Home visit; a search that *structurally cannot* match multi-word queries;
a place identity crisis where every venue exists in two-to-three ID namespaces; six coexisting
design generations rendered in light parchment (the exact palette that hurts your eyes); and
placebo surfaces (a fake Google Maps importer, dead Settings toggles) that create the "buggy"
feeling even where code works.

**The verdict is rebuild, not refactor** — a new repo on the same Firebase project, keeping the
app's three souls (the save-to-board loop, the Pinterest-grade place card, friend social proof)
and ~600 LOC of genuinely good code, and leaving everything else behind.

**The v2 design — "EMBERBOARD, the Struck Match cut":** a candlelit, personal-first Pinterest of
places. One-tap save to beautiful boards; a TONIGHT rail that answers "where are we actually
going?" from your own saves (open now, walkable, mood-matched); a morning-after card that closes
the loop; and going somewhere *visibly decorates* your boards (gold-leaf Been treatment). Three
tabs, ten routes, zero modals-as-state, no map at all in v1 — Google navigates, we curate.
Success metric: **Been-per-Want conversion, not save count.**

---

# Part I — Diagnosis: why the app feels awful

Each complaint you named, traced to verified root causes.

## 1. "Extremely long load times" ✅

Measured and traced (realistic cold Home load: **8–15s to real content**):

- **~1.18 MB of render-blocking JS** (~305 kB gzip): the entire Firebase SDK — including
  Storage, Analytics, Functions — is statically imported into the boot graph
  ([config.ts](src/firebase/config.ts)); all global modals are in the entry chunk. ✅
- **Blank screen until auth resolves**: `{!loading && children}` in
  [AuthContext.tsx:227](src/contexts/AuthContext.tsx#L227) withholds the *entire app tree* until
  Firebase Auth + a Firestore user-doc read complete (with a 3×500ms retry loop). ✅
- **A homemade queue serializes every Google Places call 500ms apart**
  ([placesQueue.ts](src/lib/placesQueue.ts)): Home's "parallel" 4–6 searchText calls take 2.5–6s
  *by design*. Google does not require this. ✅
- **A ~10-stage sequential waterfall**: geolocation await (up to 4s timeout, no cached
  last-known coords) → taste profile → serialized Google queries → friend fan-out → scoring —
  before the grid shows anything but skeletons. ✅
- **N+1 Firestore fan-outs everywhere**: one Home load bills ~400–2,000 document reads across
  15+ round-trips inside the 4,181-LOC god service. One example: a 1+200-read fan-out *to
  display an integer* (the saved-places count). ✅
- **Nothing persists**: no Firestore offline cache, in-memory caches die on refresh, and the
  service worker is network-first for everything — zero load benefit, pure overhead, plus a
  2.3 MB decorative `leaf.png` precached. ✅
- Two render-blocking Google Fonts stacks, one of them (Playfair + Caveat) **used nowhere**. ✅

## 2. "Search isn't useful" ✅

Search is a Potemkin feature. The shipping path downloads the **first ~250 Firestore docs in
random ID order** and does whole-query-string `.includes()` matching client-side — so any
multi-word or vibe query ("cozy coffee shop for working", "date night") *structurally returns
zero internal results*, and anything beyond the first-250 window is unfindable forever. ✅
The "AI search" is triple-dead (env-gated, unreachable via a `config.useAI` bug, and broken if it
ever ran). ✅ The search filters UI (distance/price/open-now) is decoration — silently ignored. ✅
The "add place to list" flow searches **4 hardcoded mock places**. ✅

## 3. "Confusing relationship with Google Maps" ✅

There is no canonical place identity. Every place lives in two ID namespaces (Google `ChIJ…` vs
random Firestore doc ID), bridged by a regex heuristic and a fuzzy name+address fingerprint
copy-pasted in four places — so the same venue exists twice with different truths. ✅ Merely
*tapping* a card fire-and-forgets a Firestore doc mint, polluting the catalog that search reads
back. ✅ A cost-safe server proxy was built and deployed but has **zero callers** — all real
Places traffic runs client-side with the API key in the bundle and in DOM img URLs. ✅ Three map
surfaces load full Google Maps JS with three private copies of loader/marker code. ✅ And the
"Import from Google Maps" flow is theater: hardcoded mock places, a `setTimeout(2000)` fake
progress bar, and a confirm handler that is a `console.log`. ✅

## 4. "Weird visuals" ✅

- **Five-to-six design-language generations render simultaneously** (botanical sage/linen,
  parchment/moss glass, stone-texture neumorphism, editorial café/honey, off-palette risograph
  posters), glued by a manual alias layer that renders near-black CTAs on old screens vs honey
  glass on new ones. ✅
- **The palette is 100% light parchment** (`#F2EAD9` body, white-alpha glass, zero dark support)
  — the direct opposite of your documented candlelit-dark need. ✅
- **`tailwind.config.js` is silently dead** (Tailwind v4, no `@config`) — ~65 utility usages in
  shipped JSX no-op. ✅
- **The feed is mostly clip-art**: risograph posters are the default card visual; real photos are
  budget-throttled to the first few cards. A place-discovery app that renders 6-category duotone
  icons is the single biggest "weird" factor. ✅
- 552 arbitrary font sizes (23 distinct), 20+ corner radii, triple-defined primitives resolving
  by cascade accident. ✅

## 5. "General bugginess / discomfort" ✅

- Every entity has **both** a modal and a page implementation (~5,200 duplicated LOC); which one
  you get depends on where you tapped. ✅
- Three uncoordinated modal systems + a **117-call-site `window.CustomEvent` bus** +
  `setTimeout(50)` handoffs + a z-index arms race (100 → 99999). ✅
- **Hardware back is broken** on the most common surface (modals are invisible to browser
  history; the OS back gesture exits the page underneath). ✅
- **The save — the core action — takes ~5 taps** through up to 3 stacked modals, with the
  pipeline re-implemented 5+ times; two copies diverged, so saves made from ListView are
  *invisible* (they never render in the list). ✅
- One save writes the same fact to **6–7 Firestore locations non-transactionally**; read paths
  then de-duplicate their own writes with 60-second time-window heuristics. ✅
- Security rules are effectively open until 2030 (`isDevMode()` with no auth check OR'd into
  nearly every write rule). ✅
- The "clean tsc" ritual was a mirage: the root tsconfig checks **zero files**; the real count is
  205 errors, including provider methods that are destructured-but-never-provided — **two visible
  buttons throw TypeError on tap**. ✅
- Trust theater: the fake Google importer and three dead Settings toggles. Placebo UI is where
  the "buggy feeling" comes from even when code paths work. 💡

## What survives (the keepers) ✅

The audit was equally clear about what's genuinely good:

| Keeper | Why |
|---|---|
| **The three souls**: save-to-board loop (Want/Been), the place-card composition, friend proof ("Saved by Maya + 2 you follow") | The product's actual identity — all three carry into v2 |
| DiscoveryCard's anatomy | "Genuinely Pinterest-grade": 5:6 image-dominant, bottom scrim, Fraunces title, italic reason line, mono distance chip, earned social chip |
| Honey-glass recipes (.btn-cta bloom, amber-pebble, dock-glass) | Already dark-leaning; the walnut end of the existing color ramp *is* the candlelit palette |
| Fraunces + Inter + JetBrains Mono + the mono eyebrow micro-language | The strongest identity work in the app; survives inversion to dark |
| `haptics.ts` (iOS WKWebView bridge) | Production-quality, theme-independent — ports verbatim |
| Motion tokens + nuanced reduced-motion policy; iOS scroll-lock CSS; `@supports` glass fallbacks | Hard-won mobile knowledge |
| Route splitting + page-shaped skeletons; route-scoped ErrorBoundary with surviving navbar | Correct instinct, correct execution |
| `placesNew.ts` (field masks, session tokens, 24h caches) | The one clean seam in the Places stack |
| The userTaste vector *model* (atomic increments, decay, suppression) | Well-engineered; wrong tier (client hot path) — becomes a server trigger |
| Per-save status/rating/note/tripDay data; threads rules; `getCountFromServer` + denormalized-snapshot patterns | The seeds of v2's pin entity |
| The instant-open-then-enrich card tap *feel* | Keep the behavior contract; rebuild as URL-backed routes |
| Places cost discipline as policy | Rare in prototypes; keep the policy, replace the plumbing |

---

# Part II — Research foundation

## Pinterest's engine, mechanically (what must translate)

- **One atomic action.** One-tap save on every image everywhere; the board picker suggests the
  most likely board; filing never blocks the impulse; undo toast, never a confirm dialog. ◑
- **The closeup→related loop is ~40% of ALL Pinterest engagement** (Pinterest Engineering /
  WWW'17 "Related Pins"). The item detail is never a dead end — it's the top of another feed. ◑
- **Masonry works because images are the ranking UI**: minimal chrome, variable-height density,
  and **dominant-color placeholder blocks** so the grid never shows spinners. ◑
- **Guided search**: designed for queries with no one right answer — after a query, slideable
  descriptive chips refine toward ideas ("plants" → "for shade"). Zero-typing browse state.
  ~97% of such searches are unbranded — exactly how people search for places. ✅/◑
- **Boards are identity projects, not folders**: vibe names, custom covers, "curating feels like
  decorating," profile as taste portfolio. ◑
- **Onboarding is a taste picker**, and its only job is to make the first feed load prove value. ◑
- **Pinterest's fatal flaw for a places app: hoarding without acting.** A pin is timeless; a
  place has proximity, hours, and a decision moment. v2 must add what Pinterest never needed:
  context-aware resurfacing, a go-now surface, one-tap "been there." ◑/💡
- Pinterest thrives on user↔content with *weak* social. Don't over-invest in DMs/comments/feeds. ◑

## Competitor gap map (2026)

| Player | Core loop | What works | What fails |
|---|---|---|---|
| **Corner** ("Pinterest for places", ~55–96k users, 4.5★, $3.75M raised) ✅ | Map-first curated saves + AI link-ingestion | Aesthetic identity; save-from-social | Forced social ("shoved in your face"), weak library mgmt, empty-pin bugs ✅ |
| **Beli** (75M reviews, 4.9★, out-reviews Yelp) ✅/◑ | Pairwise ranking as a game | Contribution volume; ranked lists beat star ratings | Status anxiety, streak fatigue, ranking tedium, cold-start "not worth it without friends" ◑ |
| **Google Maps lists** ◑ | Save pins | Ubiquity | A documented graveyard: sync failures, clutter, no visual layer — *saving places well is genuinely open* |
| **Foursquare City Guide** ✅ | City discovery | — | Dead (Dec 2024). Lesson: don't be a worse Google Maps with social bolted on |
| **Wanderlog / Airial** ◑ | Big-trip planning | Group trips / AI itineraries | Serves the annual vacation, not Tuesday night |
| **TikTok/IG** ◑ | The actual discovery firehose (~40% of Gen Z primary search) | Inspiration volume | No memory; saves rot in-app → the capture wedge exists |

**The three unclaimed spaces** ◑/💡: (1) *after the save* — nobody resurfaces saves well at
decision time; (2) intimate small-circle taste sharing without leaderboard anxiety;
(3) **the candlelit-dark aesthetic** — Corner is pastel, Beli clinical, Google gray. A dark-warm
identity is literally unoccupied in this category.

**Cold-start truth** ◑: single-player value retains without density (Mapstr proof); public
feeds/leaderboards fail cold. The category is early (Corner: 718 App Store ratings) — a solo
builder can win a niche.

## The tech menu (and the ruling constraint)

- **The Google ToS red line** ✅: Places content (names, photos, ratings) may **not** be displayed
  on or next to any non-Google map — globally; EEA terms (July 2025) exempt only lat/lng +
  place_id. place_id is storable forever; lat/lng cacheable ≤30 days; photo resource names can't
  be cached and photos need author attribution. **Places-without-any-map is explicitly legal**
  with Google attribution.
- **The open escape hatch** ✅: Foursquare OS Places (Apache 2.0, 100M+ POIs, on Hugging Face) +
  Overture (CDLA-P) + MapLibre + OpenFreeMap (verified free/unlimited/commercial, forkable dark
  styles). But open datasets have **no photos** — and photos are this product's thesis.
- **Zero-cost semantic search** ◑: batch-embed the catalog locally on your RTX 2070
  (sentence-transformers), ship a ~1–2MB static int8 vector file on Hosting, embed queries
  in-browser via transformers.js (MiniLM ~23MB; upgrade path EmbeddingGemma-300m on WebGPU).
  Cosine over 3k vectors = milliseconds, offline-capable. Skip Algolia/Typesense/Meilisearch
  (free tiers inadequate ✅) and Firestore vector search (browser SDK lacks `findNearest` ◑).
- **HF Inference free tier is a toy** ($0.10/mo credits ✅) — precompute on the local GPU; any
  LLM call goes through a Cloud Function, never a hot path.
- **Firestore `persistentLocalCache`** + TanStack Query replace the 12 ad-hoc cache layers and
  the CustomEvent bus. ✅/💡
- **iOS PWA reality** ⚠️: no Web Share Target (capture = paste-a-link or screenshot OCR), push
  unreliable. No retention promise may depend on notifications.

---

# Part III — The design: EMBERBOARD, the Struck Match cut 💡

*Four designers (Pinterest purist / evening planner / candlelit field guide / radical minimalist)
designed complete v2s independently; three judges (a daily-driver, a shipwright, and one
channeling your taste) scored them and ruled on the architecture fork. The purist chassis won
unanimously, with mandatory grafts from the others.*

## The one-liner

> A candlelit board where every place you dream about lives as one beautiful pin — one tap to
> save, one glance at 6pm to know where you're actually going tonight, and **going is what makes
> your boards more beautiful.**

**Positioning:** the personal-first "candlelit save-layer above Google Maps." Not a social
network with places; not an evening-planner product. A place-saving tool so pretty you open it
idle, that also answers "where tonight?" faster than Google's list graveyard.
**Success metric: Been-per-Want conversion, not save count.**

## The Google Maps ruling (the fork, settled) 💡

**Google-centric, NO map at all in v1.** Unanimous across the judges, and it resolves your
"confusing relationship with Google Maps" by *policy*:

- The masonry grid **is** the map. Spatial sense comes from mono walk-time chips ("8 MIN WALK"),
  computed client-side from cached coords.
- Navigation is a **hand-off**: every place closeup has one pill — "Open in Google Maps"
  (`query_place_id` deep link). *We curate; Google navigates.* One explicit outbound door instead
  of five ambiguous surfaces.
- Hybrid (Google data beside MapLibre) is a standing ToS violation — rejected outright.
  Open-catalog (FSQ OS) sells the product (photos) to buy an aesthetic (a map) and turns a
  zero-ops app into a catalog-gardening job — rejected for v1.
- **Ruling conditions:** doc ID = Google place_id everywhere (`g:{pid}`) — which kills the
  identity crisis *and* keeps the FSQ/MapLibre escape hatch a one-script migration, documented
  but never built. Coords carry `coordsFetchedAt`, refreshed by a monitored daily job; the client
  **hides** distance chips past 30 days rather than showing stale ones. Hours come only from a
  24h-cached callable (≤10 TONIGHT candidates per session) with "LIKELY OPEN" degradation — if
  the callable slips the schedule, v1 ships with **no open-now claim at all**. Honest absence
  beats a placebo.

## IA — three tabs, ten routes, zero modal managers

Every surface is a react-router route (sheets included) so hardware back always works. One
representation per entity, enforced. The only sheets: board picker and save-refine.

- **HOME** — the candlelit masonry (2-col, 5:6 PinCards: photo or hex block, bottom scrim,
  Fraunces title, italic reason line, mono distance chip, floating save bookmark). Topped by at
  most ONE contextual module, priority-ordered:
  1. **Morning-after card** (next open after a GO): *"Did you make it to Bar Doré?"* → one-tap
     Been (+ optional photo that becomes the pin's cover) or "didn't happen" — guilt-free.
  2. **TONIGHT rail** (after ~17:00, GPS granted, matches exist): go-now cards over your own
     Want pins — vitals strip `OPEN TILL 23:00 · 9 MIN ↗`, four mood chips (Cozy dinner /
     Drinks / Quick bite / Something new), amber **GO** pill = Google Maps deep link.
  3. **STILL GLOWING? card** (one faded 90-day pin, max once per session): *Rekindle / Release*.
- **SEARCH** — zero-query = a visual browse grid (12 SDXL vibe tiles + recents, never an empty
  box). Typing = instant local results above a clearly-labeled "ADD A NEW PLACE" Google
  autocomplete lane (session tokens; the two lanes are never confused). Post-query = results
  masonry + slideable guided chips ("date night" → COZY / ROOFTOP / OPEN LATE / NEAR ME), every
  result labeled *"matched: cozy · wine bar"* — no black-box recall.
- **SAVED** — the taste portfolio and de-facto profile: boards as a 2-col cover grid (hero photo
  or 4-hex mosaic, Fraunces name, mono pin count), WANT/BEEN filter, the conversion stat
  (`BEEN TO 9 OF 34`), avatar row → settings + share.

Routes: `/home` `/search` `/search/results` `/saved` `/board/:id` `/p/:placeId` `/add`
`/onboarding` `/settings` `/s/:token` (public shared board, browsable signed-out).

**The closeup (`/p/:placeId`) is never a dead end**: photo with attribution, vitals, your note,
Want/Been toggle, the Google Maps pill — and below the fold, **MORE LIKE THIS NEARBY** (vibe-tag
overlap + neighborhood + board co-occurrence, computed from Firestore, zero API calls). That's
the 40%-of-Pinterest loop, free.

## The save — one tap, one code path

1. **Tap the bookmark** → haptic tick, scale(0.97) press → pin **instantly committed** to the
   most-likely board (most shared vibe tags → last-used → auto-created "Saved").
2. A honey-glass toast rises for 5s: **"Saved to Date Night — Change · Undo"**, carrying a
   WANT/BEEN toggle (defaults Want) and a ghost "add a note" link. Undo = transactional delete.
   Change = bottom-sheet picker ("+ New board" inline). Long-press the bookmark to skip straight
   to the picker.
3. Totals: **1 tap to save, 2 to re-file, 3 to save+file+mark-Been.** One batched write; all
   fan-out (taste vector, counters, candidate pool) happens in an `onPinWrite` trigger — never
   the client hot path. App-wide law: **no confirm dialogs anywhere; undo toasts only.**

## The loop, and the anti-hoarding answer

Two tempos, deliberately unblurred (feed = algorithmic push; boards = deliberate pull — nothing
enters a board without your tap):

- **Daily**: open → Home paints <1s from local cache → browse → save 1–3 places → the taste
  vector sharpens → tomorrow's feed is more yours, *and the reason lines prove it*.
- **Evening**: TONIGHT is already dealt → mood chip → **GO** → out the door in under 60 seconds.
- **Next open**: morning-after card converts the GO into a Been.
- **Been is celebrated, not logged**: gold-leaf sweep animation, a 1px gold inner hairline, your
  photo as the pin cover, an optional six-word note in Fraunces italic — **visited places look
  better than wanted ones**, so acting on saves is how you decorate your boards. 💡
- **Fading embers**: pins untouched 90 days literally dim; one *STILL GLOWING?* card per session
  (Rekindle / Release — Release archives, never deletes).
- **The honest metric**: `BEEN TO 9 OF 34` on Saved — the app openly measures itself by visits.

No streaks. No leaderboards. No push-dependence.

## Search architecture (zero marginal cost)

V1 = **minisearch** in-browser: typo-tolerant keyword/tag/note/board-name recall over your pins +
the city candidate pool (hundreds to low thousands of docs, already client-side) — instant
per-keystroke, offline. This *structurally* fixes the dead search: token scoring over a small
personal corpus makes multi-word and vibe-ish queries hit. Branded "add this place" queries go
through the Google autocomplete lane (session tokens, details-on-select).
**Phase 1.5** (first post-launch upgrade): RTX-2070-batched catalog embeddings → static ~1–2MB
int8 vector file on Hosting → transformers.js MiniLM in-browser → *"moody wine bar for a third
date"* actually works. No search SaaS, no LLM in the hot path.

## Feed ranking — the honesty contract 💡

Transparent, deterministic, client-scored:
`score = tasteMatch + proximityBucket + freshness + dormantPinBonus + socialProof − diversityPenalty`
— weights in **one exported const**, tunable in a lunch break. **Every card must print its
top-scoring factor as the italic reason line** ("because you save wine bars" / "you saved this in
March" / "6 min away") — *if the reason can't be stated in six words, the card doesn't rank.*
The TONIGHT rail reuses the same scorer with hard gates (Want, not released, ≤25 min walk,
honestly-open) and proximity/staleness cranked. Thin-feed honesty: at low density the empty-ish
state says "small city, growing" — own-save resurfacing is always labeled, never disguised as
discovery.

## Data model (the whole thing)

- `places/{g:pid}` — name, primaryType, vibeTags[], neighborhood, cityKey, lat/lng +
  `coordsFetchedAt`, `hoursCache` (callable-written, 24h TTL), photoHex, savedCount. Created
  **only inside the save batch** — browsing never writes.
- `users/{uid}` — handle, homeCity, tasteVector map, counters.
- `users/{uid}/boards/{id}` — name, cover, pinCount, private-by-default, shareToken?.
- `users/{uid}/pins/{g:pid}` — **keyed by place ID** so saves are idempotent and saved-state is
  one read: boardIds[] (≤3), status `want|been|released`, note, sixWordNote, savedAt,
  lastTouchedAt, visitedAt, userPhotoPath, **snapshot{name, type, hex, neighborhood, lat, lng}**
  — boards, TONIGHT, and library search render with **zero joins**.
- `cities/{cityKey}/candidates/{g:pid}` — composer-maintained card snapshots (direct-query
  fallback if the composer is cut).
- `shares/{token}` — a Cloud Function bakes ≤100 denormalized card snapshots on share, so
  security rules never grant cross-user reads.
- **Server surface, deliberately small**: 2 triggers (`onPinWrite` → taste/counters/candidates;
  `onSharedBoardWrite` → baker) + 1 callable (`getHours`) + 1 monitored daily job (coords
  refresh, candidate prune, taste decay → writes `meta/jobs.lastRunAt`).
- **Rules: ~30 lines, default-deny, real from day one.** No `isDevMode`, no 2030 backdoor.
  (Old collections' rule blocks stay untouched until cutover so the old app keeps serving.)
- Client caching = Firestore `persistentLocalCache` + TanStack Query. The 12 ad-hoc caches and
  the CustomEvent bus **do not exist** in v2.

## Visual language — "Candlewax" 💡

- **Surfaces**: canvas `radial-gradient(#2E1C0D → #221407 → #1A0F05)` — walnut night with one
  fixed candle-glow radial per screen. Card `#3A2614`, sheet `#46301B`, hairline
  `rgba(255,196,110,.14)`. **No token lighter than `#4A2E12` exists** — parchment is banned at
  the token level. Plus a **"daylight ember"** brightness-bumped variant (same hue family) —
  a sidewalk app gets used at noon; this is v1 scope, not a nice-to-have.
- **Glass**: ONE recipe, chrome-only (dock/toasts/sheets, never content cards):
  `rgba(46,28,13,.58)` + blur(16px) saturate(1.5) + honey inner border + one specular "drop of
  light" — the walnut end of the existing glass.css, re-tokened. `@supports` fallback = solid.
- **Color**: honey `#E8A84C` (primary action), highlight `#FFC46E`, ember `#D9713E`, gold-leaf
  `#E8C87A` (Been), text `#F5E7D0 / #C9AE8A / #A98D66`.
- **Type**: 552 arbitrary sizes → **7 tokens**. Fraunces 600 for names + empty-state lines;
  Inter body; JetBrains Mono 11px ALL-CAPS for eyebrows/chips/vitals/reasons. The mono
  micro-language stays; the field-guide cosplay (specimen numbers, ledgers, "№01") stays dead.
- **Radii: exactly two** — 20px cards/sheets, 999px pills. Motion: the existing 120/220/320ms
  tokens + press-scale + haptics, ported verbatim.
- **Photos**: 5:6 dominant, one warm grade (`sepia(.08) saturate(1.06) brightness(.95)`) unifying
  Google/user/SDXL imagery in the same candlelight; loading = the stored dominant-hex block —
  **the grid never shows a spinner or a white box**. Four image rungs: hex block → SDXL plate →
  budget-gated Google photo (fresh, attributed, never cached) → user photo after Been (the
  long-term escape from Google's photo budget).
- **SDXL asset plan** (your RTX 2070, one style-locked prompt kit: *"candlelit editorial
  illustration, warm amber on dark walnut, soft film grain, no people, no text"*): 12 vibe tiles,
  14 category plates, 8 board-cover textures, 4 empty-state scenes — including empty-Saved as
  **a single lit match on a dark table: "Nothing saved yet. Strike the first match."**
  ~38 assets, <700kB total (vs today's 2.3MB of PNGs), SW-precached.
- Empty states = SDXL scene + one Fraunces italic earnest line + exactly one honey pill. The
  register to hold: *"a board is just a promise you make to yourself."*

---

# Part IV — Rebuild strategy

## New repo, same Firebase project 💡

**`this-is-v2`, new top-level collections, no migration code ever written.** Prod data is
seeded fiction; an owner-import script recreates the only saves that matter (your real Google
Maps saves via place_id lookups — which also seeds the city candidate pool). Rationale
(unanimous): the rot is architectural gravity — an in-repo rebuild keeps importing "just one"
old component. A new repo makes every ported line a deliberate act. The old hosting target keeps
serving until the new one passes the ship gates.

**Ports verbatim (~600 LOC, copied not imported):** haptics.ts · placesNew.ts (trimmed to
autocomplete/getDetails/photoUrl + session tokens) · the walnut-end glass recipes distilled into
one tokens.css · motion tokens + reduced-motion policy · iOS scroll-lock CSS · ErrorBoundary
pattern · Firebase bootstrap · Playwright smoke harness.
**Ports as design only (rewritten):** DiscoveryCard's composition → PinCard · userTaste math →
a Functions trigger · the 12-category taste-picker content · denormalized-snapshot patterns.
**Everything else stays behind.**

## Governance — written into the new repo's CLAUDE.md before week 1

- **The NEVER list (dead, not deferred), enforced at review:** posts, comments, DMs, activity
  feeds, hubs, public profiles, influence scores, leaderboards, streaks, a map page.
  (The audit shows mid-pass feature creep is the single biggest schedule threat.)
- **The cut order** (first → last): paste-a-link → conversion stat → fading-ember dimming →
  SDXL breadth (floor: 12 tiles + 14 plates) → the candidate-composer function (feed falls back
  to a direct query). **Never cut:** 1-tap save, TONIGHT with honest-hours-or-honest-absence,
  morning-after card, boards.
- **Hard ship gates** ("if any fails, cut scope, not the budget"): cold first-content **<1s on a
  throttled phone** · save = 1 tap · entry **<150kB gzip** · Lighthouse perf >90 · zero confirm
  dialogs · the zero-Google-photo grid state explicitly art-directed and screenshot.

## Four-week sequencing (with an abort-safe keel)

- **W1 — the keel**: shell (renders before auth) + Candlewax tokens + data core + locked rules +
  `savePin()` + Saved/boards + the owner-import script. **Day-5 gate: Add + Saved usable by you
  on real data.**
- **W2**: TONIGHT + hours callable, morning-after card, closeup + related feed. Dedicated
  dogfood on save-toast misfile rate — the toast is the entire trust surface of the core action.
- **W3**: Home feed + transparent ranking, search v1, onboarding (pick 5 vibes + city + "feed
  the machine" with ~5 real places so nothing is empty on first open).
- **W4**: anti-hoarding set, share links, SDXL batch, daylight variant, PWA/perf hardening,
  smoke tests, ship gates, preview channel → cutover.

Honest estimate ✅: the judges price the full graft set at 5–6 weeks; 4 holds only because the
cut order is written down and the week-2 keel is independently shippable.

## Top risks & tripwires

1. **Photo-budget dependency** (the soul-level risk — it's what degraded v1 into clip-art):
   hex-first design + SDXL plates as brand + *tripwire: if <⅔ of visible cards show real photos
   in week-2 dogfood, user-photo upload pulls forward.*
2. **Hours/coords honesty is existential**: one "OPEN TILL 23:00" on a shut door kills the
   TONIGHT surface. 24h callable only, LIKELY OPEN degradation, ship-with-no-claim fallback,
   monitored job, chips hidden (not faked) when stale.
3. **The save toast will misfile**: Pinterest tuned this for years. Week-2 dogfood; fallback =
   default-board + likely-board-chip (still 1 tap).
4. **Cold start beyond you**: ship for an audience of one first; no marketing until density.
   Deferred "Saved by Maya" social proof pulls forward if week-6 retention is weak — a written
   promise.
5. **iOS PWA capture friction** (no Share Target): paste-a-link is v1-stretch/v1.1-slot-#1; a
   thin native wrapper may come sooner than planned.
6. **ToS gray zone, acknowledged**: pin snapshots persist place names >30 days — the
   industry-standard posture of every save-app; snapshots stay minimal (name + hex, never
   photos/ratings/hours), and the FSQ OS escape hatch stays documented against the place_id key.

## Deferred (alive, in order)

Paste-a-link ingestion (v1.1 #1) → semantic search phase 1.5 (local embeddings +
transformers.js) → follow-a-board + friend-proof chips (the audit's third soul; when 2–6-person
circles exist) → user photos as primary pin images → screenshot OCR → thin native wrapper (Share
Target + push + TONIGHT widget) → trips as a dated-board variant → private/skippable pairwise
ranking → the open-catalog + MapLibre candlelit ember-map (**the v3 prize**, only if the catalog
is ever owned).

---

## Decisions I'd like from you (nothing blocks reading; all block week 1)

1. **Green-light the rebuild posture?** New repo, same Firebase project, old app keeps serving
   until cutover, no data migration (owner-import script instead).
2. **Name/brand**: keep "this.is", or does the candlelit reframe deserve a new name? (The panel's
   working titles — Emberboard, Matchbook — are placeholders, but the match/ember/candle motif
   runs deep in the design.)
3. **Your city** for the owner-import + first candidate pool.
4. **The NEVER list**: it kills DMs, posts, rankings, and the taste-meter theater. Any of those
   you're not ready to let die?

## Provenance

10 audit/research agents over the full codebase (with a production build measured), 4 independent
full-app designs, 3 adversarial judges, 1 synthesis — ~2M tokens of agent work, July 1–2, 2026.
Full transcripts in the session workflow directories; the distilled brief lives alongside them.
