# The Google Ruling — this.is v2

**Status: adopted 2026-07-02.** This document resolves the photo/dependency/map dilemma. Every load-bearing fact is tagged **[verified]** (fetched from primary source this pass, URL+date given), **[sourced]** (secondary or partially inferred), or **[UNVERIFIED]**.

---

## 1. The dependency, priced

Since March 2025 there is no $200/mo universal credit; each SKU has its own free monthly allowance — 10,000 events per Essentials SKU, 5,000 per Pro, 1,000 per Enterprise. Still in force on the pricing page last updated 2026-06-29 **[verified:** developers.google.com/maps/billing-and-pricing/pricing, fetched 2026-07-02**]**.

Our exact usage maps to three SKUs:

- **Place Details, our mask** (`id,displayName,formattedAddress,location,primaryType,photos.name,photos.authorAttributions`) bills as **Place Details Pro, $17/1,000** (5,000 free/mo). Two fields cause this: `displayName` and `primaryType` are Pro-tier; `formattedAddress`/`location` are Essentials ($5/1K); `id` and the `photos.*` metadata are in the free IDs-Only tier. One Pro field promotes the whole call **[sourced:** sku-details + place-details docs, 2026-07-02; `photos.authorAttributions` tier inferred from parent field**]**.
- **Photo media requests** are **Enterprise-tier: $7/1,000, only 1,000 free/mo** **[verified:** pricing + sku-details, 2026-07-02**]**.
- **Autocomplete** is $0 when the session token terminates in a Pro-tier Details call (our save flow does exactly this); abandoned sessions bill $2.83/1K with 10K free **[verified:** session-pricing docs, 2026-07-02**]**.

Worst-case uncached math **[verified computation from the rates above]**:

| Scale | Details Pro | Photo media | Monthly bill |
|---|---|---|---|
| 1 dogfood user | ~173 calls (3.5% of free) | ~130 (13% of free) | **$0** |
| 100 users | ~17.3K → 12.3K billable = $209 | ~13K → 12K billable = $84 | **~$293** |
| 1,000 users | ~173K → ~$2,600 (graduated) | ~130K → ~$862 | **~$3,450–3,500** |

Cost first appears at roughly **29 users** (Details) and **8 users** (photos). Two conclusions: the dogfood phase is genuinely free with ~29x headroom, and **the field mask, not the map question, is the dominant cost lever** — since pins already snapshot name and type, the closeup can request only `id,photos.name,photos.authorAttributions` (free IDs-Only tier) and render name/type from the snapshot, collapsing the $2,600 line to ~$0. Photo metadata is free; only the media bytes cost money.

## 2. The legal posture

US billing (Piscataway) means the non-EEA terms govern, even with worldwide users (EEA terms bind projects with EEA billing addresses) **[verified:** cloud.google.com/terms/maps-platform/eea/maps-service-terms + developers.google.com/maps/comms/eea/places, 2026-07-02**]**.

**What we may do:** display Places content with no map at all — Service Specific Terms §14.1 explicitly permits mapless use (doc last modified 2026-06-10) **[verified]**. Store `place_id` indefinitely (exempt from caching restrictions) and lat/lng for 30 consecutive days — our `g:{pid}` keys and 30-day honesty window match the letter of the terms exactly **[verified:** places policies page updated 2026-06-29; SST §14.3**]**.

**What we may not do:** (a) cache photo media or even photo names — "You cannot cache a photo name. Also, the name can expire" **[verified:** place-photos docs, 2026-07-02**]**; (b) use Places content "in conjunction with a non-Google map" — §14.2, and the non-EEA terms have **no lat/lng carve-out** (that exists only in the EEA terms) **[verified]**; (c) "copy and save business names, addresses, or user reviews" — main ToS §3.2.3(a), last modified 2026-06-23 **[verified]**.

**Our exposure:** the indefinite name/type/neighborhood snapshot technically exceeds the permitted cache list. Common industry practice, no public enforcement against small bookmark apps found, but the letter of the rule says place_id only **[UNVERIFIED enforcement posture]**. The dominant-color hex is a gray area under §3.2.3(c) "No Creating Content"; de-minimis and not addressed anywhere in the terms **[UNVERIFIED interpretation]**. Mitigation: treat the snapshot as a *refreshable cache*, not an archive — periodically re-derive it from a legitimate Details call.

**Attribution we currently owe and don't render:** "Google Maps" logo (16–19dp) or text (Roboto, 12–16sp, 4.5:1 contrast) near Google-sourced content even mapless, and `authorAttributions.displayName` (linked) in close proximity to **every** displayed photo **[verified:** places policies, updated 2026-06-29**]**. This is a real, fixable gap.

**EEA note:** never move billing to an EEA entity. The EEA terms (effective 2025-07-08) restrict even mapless Places use to an enumerated permitted-uses list that does not clearly include a consumer discovery grid, and ban Places content with *any* map **[verified]**. The EEA regime is also a directional signal: Google is squeezing Places display toward its UI Kit widget ($1/1K, usable with any map, but it's Google's component — it cannot be our masonry tile) **[verified §15.1 UI Kit carve-out; pricing sourced]**.

## 3. The photo problem

Hard constraint first: **there is no cache-based solve.** Google photo bytes and names cannot be stored, so a Google-photo grid means paying $7/1K per *render*, forever. And the open catalogs don't help: FSQ OS Places (~108.7M POIs, Apache 2.0) and Overture (~72M+, CDLA-P-2.0) contain **zero photos** — photos remain a Foursquare commercial "rich attribute" **[verified:** docs.foursquare.com places-os-data-schema + release notes, 2026-07-02**]**. Ranked options:

1. **User-uploaded photos at save time — adopt as primary.** Make "snap it when you save it" the core ritual of adding a pin. Fully cacheable, zero ToS constraint, and at n=1 the owner can personally photograph every dogfood pin. This is also the only option that compounds into a moat: at small-launch scale, community photos become the product's own catalog. Cost: Firebase Storage pennies. **[verified feasibility — this is our own content]**
2. **Owner-generated plate art + dominant-color blocks — keep as the fallback chain.** The existing poster/color system stays for pins without a photo. Derive the hex at render time from a legitimately displayed photo rather than persisting it as a standalone asset — cheaper legal framing **[UNVERIFIED but conservative]**.
3. **Budget-gated live Google photos, closeup only.** Keep exactly as designed: fetch on closeup open, ≤3 media requests per closeup, lazy-loaded, always attributed. 1,000 free/mo covers dogfooding 7x over. Never promote to the grid — that's the one move current pricing genuinely punishes (10–50x media multiplication) **[verified pricing; multiplier is analytical]**.
4. **Wikimedia Commons via Wikidata P18 — supplemental, landmarks only.** License-viable (CC-BY/CC-BY-SA) but near-zero coverage for ordinary restaurants/cafés **[UNVERIFIED coverage assessment]**. Worth a lookup at save time for the landmark subset; not a grid strategy.
5. **Mapillary — rejected.** CC-BY-SA street-level storefronts with share-alike obligations; not the appetizing interior/food imagery the thesis needs **[sourced]**.

**Recommendation:** #1 as the product bet, #2 as fallback, #3 unchanged, #4 as a cheap enrichment. The grid's visual thesis is fulfilled by photos *we own*, not photos we rent per render.

## 4. The map question

**Keep mapless.** Three reasons: (a) it's the explicitly permitted posture under §14.1 **[verified]**; (b) adding MapLibre *today* would be a ToS violation, because non-EEA §14.2 bars Google-sourced names/coordinates near a non-Google map with no carve-out **[verified]**; (c) nothing in the product currently needs one — navigation hand-off to Google Maps covers the job.

**When a map becomes worth it:** when a real feature demands spatial browsing (trip-day routing, "what's near me now") *and* pins carry non-Google coordinates. The legal path is to re-source coordinates+names from Overture/FSQ OS (matched by name+geo conflation, not copied from Google fields) so the map layer contains zero Google Maps Content **[verified constraint; approach analytical]**.

**What it costs to build:** small. MapLibre GL + OpenFreeMap's public instance is free, key-less, commercial-OK, and survived ~100K req/sec in Aug 2025 — though it is a donation-funded single-maintainer service **[sourced:** openfreemap.org + hyperknot blog, 2026-07-02**]**. Graduation path: self-hosted Protomaps PMTiles on Cloudflare R2, ~$2–15/mo at our scale **[sourced]**. The render layer is a weekend-scale add since pins already store lat/lng; the *data* re-sourcing is the real work — ~2–4 focused weeks for a hybrid (keep `g:{pid}`, add matched `fsq_place_id`), 6–10+ weeks for a full cutover that would degrade autocomplete quality and closure freshness, Google's two genuinely superior behaviors **[UNVERIFIED solo-dev estimates]**.

## 5. The ruling

**Decisions, effective now:**

1. **Stay Google-only for catalog, autocomplete, and closeup enrichment.** The dogfood phase is $0 with ~29x headroom; migration solves costs we don't have and leaves the grid just as photo-empty.
2. **Split the field mask.** Save-time Details keeps the full Pro mask (it must terminate the autocomplete session and it legitimately refreshes the snapshot). Closeup Details drops to `id,photos.name,photos.authorAttributions` (free IDs-Only tier), rendering name/type from the snapshot; if the snapshot is >90 days old, do one Pro-mask refresh instead. This pre-neutralizes ~75% of the 1,000-user bill.
3. **Ship attribution this week:** "Google Maps" text near Google-sourced content, and author attribution beside every closeup photo. Cheapest compliance fix on the board.
4. **Adopt "snap it when you save it"** as the pin-creation ritual; photo fallback chain = user photo → plate/poster art → color block. Google photos remain closeup-only, live, attributed, ≤3 per closeup. **Never on the grid, never cached.**
5. **Reframe the snapshot as a refreshable cache** (decision 2's 90-day refresh implements this); keep the 30-day lat/lng honesty window and `g:{pid}` keys unchanged.
6. **Store a matched `fsq_place_id` alongside `g:{pid}` at save time** (one-time conflation against the monthly FSQ OS parquet). Costs ~nothing; converts a forced future migration from a 6–10-week crisis into a 2–4-week hybrid switch.
7. **No map, no Places UI Kit, no EEA billing entity.** UI Kit can't be our masonry tile and our own closeup calls are already near-free.
8. **Keep `getHours` undeployed** until a feature demands it; set GCP budget alerts at $10 and $50 now.

**Tripwires that reopen this ruling:**

- **Photo media >800/mo or Details Pro >4,000/mo** (80% of allowances) → enforce hard photo budget caps; audit for leaks.
- **~25+ weekly actives** → real money starts; verify decision 2 shipped, re-run the scenario math.
- **Google changes the March-2025 allowances, the Photos SKU, or extends EEA-style enumerated uses to the US** (pricing page moved 2026-06-29 — it's live) → execute the hybrid FSQ migration decision 6 pre-paid for.
- **User-photo attach rate <40% of new pins after one month of dogfooding** → the ritual failed; invest in owner-plate art and Wikidata P18 backfill instead.
- **A trip-routing or nearby-now feature reaches the roadmap** → build the map the legal way: Overture/FSQ-sourced data + MapLibre + OpenFreeMap, zero Google content on or near it; watch Overture's `categories` removal slated for Sept 2026 (target `basic_category` from day one) **[sourced]**.
- **OpenFreeMap reliability wobbles** → Protomaps on R2, ~$15/mo ceiling.

The one-sentence version: **Google stays the brain, but our users become the eyes — and the mask split plus the fsq_place_id shadow key mean Google can never surprise us with a bill or a terms change we can't walk away from in a month.**

---

## Addendum (same day) — the empty-app correction

The ruling above optimized costs for an app with content; the owner's actual complaint was that
**the app had no content**: "it needs a database of pictures and information about places that
already exists in Google Maps but is expensive to constantly request." Adopted and implemented:

9. **The seeded candidate pool IS the catalog posture.** `scripts/seed-candidates.mjs` sweeps
   Text Search around configured anchors (~36 Pro-tier calls/run — inside the 5K free allowance)
   and writes `cities/{cell}/candidates` via REST. Re-running it monthly is the ≤30-day
   refreshable-cache posture. First run: 287 real places across the Piscataway area. This makes
   Home/Search alive on first open, signed-out included.
10. **Discovery photos are live, budget-gated, never cached**: the DISCOVER rail fetches photo
    refs free-tier per render and media under a hard 8-per-session cap (~250 media/mo at heavy
    dogfood use, inside the 1K free) with attribution. The grid therefore shows REAL imagery at
    $0 today; user photos take over per decision 4 as saves accumulate.
11. At >25 weekly actives (the tripwire above), the per-session cap and pool-refresh cadence are
    the two dials that keep this free-tier; both are one-line constants.
