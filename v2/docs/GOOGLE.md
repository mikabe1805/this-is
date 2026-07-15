# The Google Ruling — this.is v2

**Status: corrected 2026-07-12.** The July 2 analysis is retained for decision history, but the
July 12 correction below supersedes every conflicting cost, cache, seed-pool, and snapshot claim.
The local app now stores only an opaque Place ID plus a label/category the person explicitly
confirms; Google facts remain live and in memory. Existing production legacy rows have not been
inspected or cleaned, so no external pilot may rely on them. This is a conservative engineering
interpretation, not legal advice.

## July 12 correction — controlling ruling

Independent review against Google's current primary documentation found four material errors:

1. An Autocomplete session terminated by any Pro-or-higher Place Details field is billed as
   **Place Details Enterprise + Atmosphere**, not at the requested Pro tier. The capture path now
   terminates with the Essentials-only mask `id,formattedAddress,location,types`; the selected
   autocomplete label supplies the temporary UI name.
2. Place IDs may be retained. New saves no longer persist Places API name, type, neighborhood, or
   coordinates: a person confirms their own label and broad category before saving. Legacy rows are
   unresolved owner-only history until that confirmation, and cannot become group evidence.
3. The public Google Text Search seed pool is not an acceptable refreshable-cache strategy. Both
   seed scripts are disabled, city-pool reads are denied, and the client returns no seeded rows.
   Existing remote rows, if any, require a separately reviewed retirement action; do not inspect or
   mutate production data during development.
4. Current text attribution, pilot Terms/Privacy incorporation, and photo-specific author/source
   links and a dark server-counted media allowance are implemented locally. Owner identity/legal
   review and operational activation evidence remain incomplete. Client localStorage is only a
   runaway-render fuse.

The implemented replacement boundary is: user-authored durable place memory, an indefinitely stored
Google Place ID alias, and live in-memory Google context. A future owned/open catalog remains
optional and must carry independent provenance; Google content must never populate or correct it.

---

## 1. The dependency, priced

Since March 2025 there is no $200/mo universal credit; each SKU has its own free monthly allowance — 10,000 events per Essentials SKU, 5,000 per Pro, 1,000 per Enterprise. Still in force on the pricing page last updated 2026-06-29 **[verified:** developers.google.com/maps/billing-and-pricing/pricing, fetched 2026-07-02**]**.

Historical July 2 estimate (superseded):

- ~~Place Details with Pro fields bills at Place Details Pro.~~ This is false for an Autocomplete-
  terminating request; current session pricing promotes it to Enterprise + Atmosphere.
- **Photo media requests** are **Enterprise-tier: $7/1,000, only 1,000 free/mo** **[verified:** pricing + sku-details, 2026-07-02**]**.
- **Autocomplete** is $0 when the session token terminates in a Pro-tier Details call (our save flow does exactly this); abandoned sessions bill $2.83/1K with 10K free **[verified:** session-pricing docs, 2026-07-02**]**.

The July 2 user-count table and “29 users before cost” conclusion are revoked. Current accounting
must separate three flows and verify them in the billing console:

- Autocomplete capture: Autocomplete Requests plus one Essentials terminating Details call.
- Final-candidate discovery: up to three explicit E+A enrichments per cold plan.
- Photo media: up to three budgeted media events per cold plan.

Do not translate per-device activity into a project allowance. Hard quota, server counters, and SKU
telemetry—not a spreadsheet projection—define the public budget.

## 2. The legal posture

US billing (Piscataway) means the non-EEA terms govern, even with worldwide users (EEA terms bind projects with EEA billing addresses) **[verified:** cloud.google.com/terms/maps-platform/eea/maps-service-terms + developers.google.com/maps/comms/eea/places, 2026-07-02**]**.

**What we may do:** display Places content with no map at all — Service Specific Terms §14.1 explicitly permits mapless use (doc last modified 2026-06-10) **[verified]**. Store `place_id` indefinitely (exempt from caching restrictions) and lat/lng for 30 consecutive days — our `g:{pid}` keys and 30-day honesty window match the letter of the terms exactly **[verified:** places policies page updated 2026-06-29; SST §14.3**]**.

**What we may not do:** (a) cache photo media or even photo names — "You cannot cache a photo name. Also, the name can expire" **[verified:** place-photos docs, 2026-07-02**]**; (b) use Places content "in conjunction with a non-Google map" — §14.2, and the non-EEA terms have **no lat/lng carve-out** (that exists only in the EEA terms) **[verified]**; (c) "copy and save business names, addresses, or user reviews" — main ToS §3.2.3(a), last modified 2026-06-23 **[verified]**.

**Our exposure:** the indefinite name/type/neighborhood snapshot exceeds the permitted cache list,
and refreshing it does not cure durable storage. The existing lat/lng fields also remain stored after
30 days even though distance display stops using them. Treat this as a blocker requiring owned/open
facts plus deletion/TTL mechanics, not as an accepted gray-area mitigation.

**Attribution implemented locally:** mapless Google content carries legible `Google Maps` text, and every rendered live photo links its author/source overlay to that photo's returned `photos.googleMapsUri`. The nested `photos` object remains in the Details IDs-only tier; photo names and media are not cached. Public launch still needs a full rendered-surface audit.

**EEA note:** never move billing to an EEA entity. The EEA terms (effective 2025-07-08) restrict even mapless Places use to an enumerated permitted-uses list that does not clearly include a consumer discovery grid, and ban Places content with *any* map **[verified]**. The EEA regime is also a directional signal: Google is squeezing Places display toward its UI Kit widget ($1/1K, usable with any map, but it's Google's component — it cannot be our masonry tile) **[verified §15.1 UI Kit carve-out; pricing sourced]**.

## 3. The photo problem

Hard constraint first: **there is no cache-based solve.** Google photo bytes and names cannot be stored, so a Google-photo grid means paying $7/1K per *render*, forever. And the open catalogs don't help: FSQ OS Places (~108.7M POIs, Apache 2.0) and Overture (~72M+, CDLA-P-2.0) contain **zero photos** — photos remain a Foursquare commercial "rich attribute" **[verified:** docs.foursquare.com places-os-data-schema + release notes, 2026-07-02**]**. Ranked options:

1. **User-uploaded photos at save time — adopt as primary.** Make "snap it when you save it" the core ritual of adding a pin. Fully cacheable, zero ToS constraint, and at n=1 the owner can personally photograph every dogfood pin. This is also the only option that compounds into a moat: at small-launch scale, community photos become the product's own catalog. Cost: Firebase Storage pennies. **[verified feasibility — this is our own content]**
2. **Owner-generated plate art + dominant-color blocks — keep as the fallback chain.** The existing poster/color system stays for pins without a photo. Derive the hex at render time from a legitimately displayed photo rather than persisting it as a standalone asset — cheaper legal framing **[UNVERIFIED but conservative]**.
3. **Budget-gated live Google photos, explicit closeup or final three only.** Saved-place closeups and visible final-three group cards share one authenticated project counter and always render attribution. Never promote Google media to Keep/search grids — that is the move current pricing genuinely punishes (10–50x media multiplication) **[verified pricing; multiplier is analytical]**.
4. **Wikimedia Commons via Wikidata P18 — supplemental, landmarks only.** License-viable (CC-BY/CC-BY-SA) but near-zero coverage for ordinary restaurants/cafés **[UNVERIFIED coverage assessment]**. Worth a lookup at save time for the landmark subset; not a grid strategy.
5. **Mapillary — rejected.** CC-BY-SA street-level storefronts with share-alike obligations; not the appetizing interior/food imagery the thesis needs **[sourced]**.

**Recommendation:** #1 as the product bet, #2 as fallback, #3 unchanged, #4 as a cheap enrichment. The grid's visual thesis is fulfilled by photos *we own*, not photos we rent per render.

## 4. The map question

**Keep mapless.** Three reasons: (a) it's the explicitly permitted posture under §14.1 **[verified]**; (b) adding MapLibre *today* would be a ToS violation, because non-EEA §14.2 bars Google-sourced names/coordinates near a non-Google map with no carve-out **[verified]**; (c) nothing in the product currently needs one — navigation hand-off to Google Maps covers the job.

**When a map becomes worth it:** when a real feature demands spatial browsing (trip-day routing, "what's near me now") *and* pins carry non-Google coordinates. The legal path is to re-source coordinates+names from Overture/FSQ OS (matched by name+geo conflation, not copied from Google fields) so the map layer contains zero Google Maps Content **[verified constraint; approach analytical]**.

**What it costs to build:** small. MapLibre GL + OpenFreeMap's public instance is free, key-less, commercial-OK, and survived ~100K req/sec in Aug 2025 — though it is a donation-funded single-maintainer service **[sourced:** openfreemap.org + hyperknot blog, 2026-07-02**]**. Graduation path: self-hosted Protomaps PMTiles on Cloudflare R2, ~$2–15/mo at our scale **[sourced]**. The render layer is a weekend-scale add since pins already store lat/lng; the *data* re-sourcing is the real work — ~2–4 focused weeks for a hybrid (keep `g:{pid}`, add matched `fsq_place_id`), 6–10+ weeks for a full cutover that would degrade autocomplete quality and closure freshness, Google's two genuinely superior behaviors **[UNVERIFIED solo-dev estimates]**.

## 5. The ruling

**Decisions, effective now:**

1. **Google is live enrichment, not the stored catalog.** The durable catalog must be owned/open;
   the Google Place ID is an alias. No Google-derived public directory.
2. **Split the field mask.** Autocomplete capture terminates with Essentials only. Explicit live
   closeup enrichment may request cost-approved fields without turning those fields into durable
   owned facts.
3. **Keep attribution enforced:** "Google Maps" text near Google-sourced content, with a legible
   author/source link beside every rendered live photo.
4. **Adopt "snap it when you save it"** as the pin-creation ritual; photo fallback chain = user photo → plate/poster art → color block. Google photos remain explicit-closeup/final-three only, live, attributed, server-budgeted. **Never on Keep/search grids, never cached.**
5. **Retire the current snapshot shape before external use.** UI hiding is not deletion. Every
   retained field needs an owned source or an enforced Google TTL.
6. **Choose one open identity spine before conflation.** Current prose drifts between FSQ OS and
   Overture/GERS; no shadow-key claim is approved until a real ingestion and provenance design lands.
7. **No map, no Places UI Kit, no EEA billing entity.** UI Kit can't be our masonry tile and our own closeup calls are already near-free.
8. **Keep `getHours` undeployed** until a feature demands it; set GCP budget alerts at $10 and $50 now.

**Tripwires that reopen this ruling:**

- **Photo media >800/mo, E+A enrichment >800/mo, or capture Essentials/Autocomplete nearing their
  current allowance** → stop enrichment, audit masks/session termination, and reprice from the live
  billing console.
- **~25+ weekly actives** → real money starts; verify decision 2 shipped, re-run the scenario math.
- **Google changes the March-2025 allowances, the Photos SKU, or extends EEA-style enumerated uses to the US** (pricing page moved 2026-06-29 — it's live) → execute the hybrid FSQ migration decision 6 pre-paid for.
- **User-photo attach rate <40% of new pins after one month of dogfooding** → the ritual failed; invest in owner-plate art and Wikidata P18 backfill instead.
- **A trip-routing or nearby-now feature reaches the roadmap** → build the map the legal way: Overture/FSQ-sourced data + MapLibre + OpenFreeMap, zero Google content on or near it; watch Overture's `categories` removal slated for Sept 2026 (target `basic_category` from day one) **[sourced]**.
- **OpenFreeMap reliability wobbles** → Protomaps on R2, ~$15/mo ceiling.

The one-sentence version: **Google stays the brain, but our users become the eyes — and the mask split plus the fsq_place_id shadow key mean Google can never surprise us with a bill or a terms change we can't walk away from in a month.**

---

## Addendum (same day) — the empty-app correction **REVOKED JULY 12**

The ruling above optimized costs for an app with content; the owner's actual complaint was that
**the app had no content**: "it needs a database of pictures and information about places that
already exists in Google Maps but is expensive to constantly request." Adopted and implemented:

9. ~~**The seeded candidate pool IS the catalog posture.** `scripts/seed-candidates.mjs` sweeps
   Text Search around configured anchors (~36 Pro-tier calls/run — inside the 5K free allowance)
   and writes `cities/{cell}/candidates` via REST. Re-running it monthly is the ≤30-day
   refreshable-cache posture. First run: 287 real places across the Piscataway area. This makes
   Home/Search alive on first open, signed-out included.~~ **Revoked:** this rehosts Google content.
10. ~~**Discovery photos are live, budget-gated, never cached** on the seeded pool.~~ **Revoked:**
    the source pool is retired and a client counter cannot assert project-wide cost. Live photos may
    return only on approved final-candidate/closeup surfaces with current attribution and budget.
11. ~~At >25 weekly actives, the pool-refresh cadence controls cost.~~ **Revoked:** refreshing does
    not create a storage permission.

## Group-native correction — July 11, 2026

The earlier `25/day ≈ 750/month` reasoning was valid for only one device and therefore was not a
project budget. It must not be used for public-scale cost claims. The client guard is now six unique
place photos per device per day—enough for two three-candidate decisions—and is explicitly only a
dogfood runaway-render defense.

Before public group use, the implemented server-owned monthly allowance and remote kill switch still
require reviewed secret, Cloud quota, billing-alert, and SKU-telemetry evidence. Graceful poster/material
fallbacks remain the default. Candidate cards remain limited to one lazy-loaded image each. A group decision therefore
earns no more than three live Google images; lists and off-screen content do not prefetch them.

Cross-area recommendations also change the query posture. When a plan explicitly targets Cresskill,
that target overrides the user's Piscataway device/home bias. The service retrieves one bounded
candidate set for the target area, reuses it across members of the same active plan where terms
permit, and reranks locally from this.is taste evidence. It must not run one Google search per member.
Current July 2026 pricing inputs remain: 5,000 free monthly Nearby/Text Search Pro events followed by
$32/1,000, and 1,000 free monthly photo-tier events followed by $7/1,000. Recheck the official
pricing page before public launch.
