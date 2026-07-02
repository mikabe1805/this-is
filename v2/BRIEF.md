# this.is — Product & Strategy Brief

**The candlelit end of going out: a hand-curated, taste-ranked discovery feed for the intimate low-lit rooms worth leaving the house for.**

---

**TLDR.** this.is is a public, solo-built place-discovery PWA (React/TS + Firebase) built on one wedge that no incumbent can occupy: *discovery by subtraction*. Where Google's Ask Maps (Gemini, launched Mar 12 2026, ranking over 300M places against the full text of the review corpus), Corner (~275K crowdsourced locations), and Beli (Elo leaderboards, 75M+ reviews) all optimize for consensus, breadth, or user-generated volume, this.is hands a stranger a *small opinionated list* — ~150 hand-vetted low-lit rooms per city (natural-wine bars, listening bars, cozy cocktail dens, late candlelit cafés) — and is trusted precisely because of what it leaves off. A 500M-contributor consensus machine cannot rank *against* its own aggregate signal; a solo curator can. The direction is fixed and correct. Two things are not yet built: a genuinely great editorial **spot page** (the owner's #1 felt-problem — "intensely underbaked after clicking a spot"), and a decided **data/photo architecture** that lets the app be non-empty worldwide without becoming "a worse Google Maps." This brief settles both, decisively, and ends with the real questions the owner should get outside counsel on.

---

## 1. What this.is is

**In one line:** *Hand a stranger the ~150 low-lit rooms in a city actually worth leaving the house for — and be trusted because of what's been left off.*

**In 30 seconds:** You open this.is and see a candlelit feed — a masonry of real photographs of intimate rooms, each card leading with a curator's point-of-view line and a walk-time chip, ranked by the vibes you chose at onboarding and how close you are. It is not a search box, not a map, not a review aggregator, not a save-organizer. It is a short, opinionated, deliberately-incomplete list you can trust the way you trust the one friend with great taste — the friend who, crucially, also tells you where *not* to go. Tap a room and you get an editorial spot page: the owned photo of the room, why it's on the list, who it's *not* for, one honest hours line, and a single door out to Google Maps for navigation. Save is a flat "want to go." That's the whole product, and the discipline of that "whole" is the strategy.

**What it is technically (current state, mid-2026):** Home is a discovery feed that ranks a curated catalog — 26 real NYC/Jersey-City low-lit venues seeded as a scaffold — by chosen "vibes" plus proximity. A vibe-picker onboarding seeds taste. Save is a flat "want to go" list. Place identity is keyed by Google `place_id` as `g:{place_id}` (the settled identity ruling that also keeps the escape hatch a one-script migration). Photos are currently pulled live from Google Places, budget-gated; the plan (Section 6) is to own the hero photography for the curated venues so Google contributes zero hero pixels. The visual language is **"Salon Madder"** (see `v2/DESIGN.md`): deep oxblood-black surfaces (`#140D10` canvas, `#1E1418` cards — a low-lit salon gallery wall), a single madder-red action (`#C13B4C`), warm "picture-light" as the only celebration accent, Fraunces for names, Inter for body, JetBrains Mono for the all-caps eyebrow/chip micro-language. Parchment, and the walnut/honey/candle-ember palette of an earlier draft, are banned at the token level. *(An earlier "Candlewax" ember/honey direction was explicitly rejected by the owner; do not reintroduce it.)*

**The NEVER list (a moat, not a limitation).** Discovery is the one job. No DMs, no social feeds, no comments, no leaderboards, no streaks, no influence scores, no public-profile social graph, no map page — and pointedly *not* a save-organizer, a trip planner, or a "where do I go tonight" decision engine. Every one of those is a different product that dilutes the single thing this.is is trying to be excellent at, and every one is the direction feature-creep pulls toward. The list is enforced at review.

---

## 2. The problem: why discovery is broken

Place discovery in 2026 is splitting into two products that cannot be the same product, and everyone is building only the first one.

**Problem 1 — Everything optimizes for consensus, so everything converges on the tourist default.** Ranking by aggregate signal — reviews, ratings, saves, Elo scores — mathematically converges on the most-reviewed place, which is the touristy consensus. The 40-seat listening bar with 60 reviews will always lose to the 2,000-review restaurant, because *volume is the ranking substrate*. The more places and reviews a consensus engine ingests, the *more* it centers the default and the *less* it can hand you the room the locals guard. (This is an analytical claim about how aggregate ranking behaves, not a cited empirical finding — but it is the load-bearing observation, and the entire competitive landscape is consistent with it.)

**Problem 2 — The discovery firehose has no retention layer, so desire rots.** Social video is where the actual demand signal lives — 67% of Gen Z rely on social platforms to decide where to eat, and 41% of Gen Z now turn to social platforms *first* when seeking information, ahead of traditional search engines at 32% (Sprout Social, 2025). But it is a firehose with no memory. You screenshot a candlelit bar from a Reel and it dies in your camera roll or a Google saved-list you never reopen — the "saves rot" problem. TikTok/Instagram manufacture desire and provide zero structure to act on it.

**Problem 3 — The "save it somewhere" apps have storage but no opinion.** Mapstr (4M+ users, 90M+ registered places) and Google's own saved-lists are personal-CRM-for-places: excellent at remembering where you said you might go, incapable of telling you where to go. They confirm demand for saving, not for discovery-by-curation.

The gap, then: as answers become infinite and free, the scarce valuable thing is *editorial refusal* — a human who has been to the rooms and will stake a reputation on a short list, including the omissions. Word of mouth remains the single most-cited way people find new restaurants (24%, ahead of Google's 19%, per a 2025 Toast channel survey), and personal recommendations command ~88% trust (Buyapowa, 2025). The opportunity is to *productize word of mouth* — the exact thing every consensus, breadth, and storage machine structurally cannot do.

---

## 3. The wedge & positioning

**The wedge is discovery by subtraction.** this.is's defining move is not that it lists good places — Google has all of them — but that it hands you a *small list defined partly by what it leaves off*. Subtraction is anti-consensus by definition. A model optimizing for the most-supported answer cannot simultaneously optimize for the deliberately-narrow, deliberately-exclusionary one; those are opposite objective functions. Google can out-index everyone on Earth and can never out-*curate*, because curation requires leaving revenue-generating consensus results off the list.

**The positioning is "the candlelit end of going out."** Not "everywhere to eat." A single narrow taste — the intimate, low-lit, worth-leaving-the-house room — rendered in a salon-dark editorial style that is itself unoccupied in the category (Corner is pastel, Beli is clinical, Google is gray; a dark-warm identity is literally empty ground). The narrowness is the point: it lets one human be *embarrassingly good* at ~150 rooms per city, which no crowdsourced or consensus system can match on quality-per-listing.

**Who it's for.** The intentional goer-out, mid-20s to 40s, who treats a night out as an aesthetic choice rather than a logistics problem — the minority who already resent the 2,000-review pin and screenshot a friend's text of three bars. This is deliberately a *wedge, not a mass market*: the first 5,000 true believers who feel *seen* by the leave-it-off editorial voice are worth more than 500,000 people who saw a card and bounced.

**Why solo is a feature here, not a handicap.** The moat is taste and exclusion — the two things that get *weaker*, not stronger, with scale and crowdsourcing. this.is doesn't need to out-index Google or reach Corner's contributor density; it needs one curator and ~150 rooms per city, expandable city-by-city. A solo builder cannot win the consensus game and should never try; the point-of-view game is the one game where scale is a liability to the opponent.

---

## 4. Competitive research (current, mid-2026)

The strategic point that matters most is not who is biggest. It is that **every serious place-discovery product in mid-2026 is architecturally a consensus or breadth machine**, and that architecture is structurally incapable of the one thing this.is is built to do.

**Google Maps + Ask Maps (Gemini) — the consensus engine, now conversational.** Ask Maps, a Gemini-powered conversational search layer, launched **March 12, 2026** in the US and India on Android and iOS (desktop "coming soon"). It answers complex natural-language questions, builds itineraries, and personalizes off your search and saved-place history. It ranks recommendations off **300 million places** and the Google review corpus, and — critically — Gemini now reads the *full text* of reviews, not just star ratings: "the specific phrases customers use… are what Gemini uses to decide which businesses to recommend." (blog.google, 2026-03-12; MacRumors, 2026-03-12; CNBC, 2026-03-12.) *(Note: the owner-brief's "500M reviews" figure could not be independently confirmed; public sources cite "300M+ places" and "reviews from the Google community" without a hard review count — treat the review-count number as unverified.)* Why it structurally cannot do POV/subtraction: Ask Maps is a smarter *retriever over the same corpus*, so its answers regress toward the mean of what everyone wrote. It can summarize consensus more fluently; it cannot hold a taste that says "these twelve, and pointedly not the famous one two doors down."

**Corner — the closest philosophical competitor, and its cold-start tax.** Corner (founded 2022, Eliza Wu & Jake Xia) is the most direct "vibes over ratings" analog, raising **$3.75M** (Abstract Ventures, Tapestry, 1517, plus angels including Partiful cofounder Shreya Murthy), pitching itself as "digitizing word of mouth," and using Anthropic's Claude for recommendations. Its defining decision is also its structural weakness: Corner **deliberately refused to scrape existing data** and built entirely on user contributions, reaching **~275,000 locations**, all UGC. That is a hard cold-start / cold-city dependency — Corner is only as good as the density of contributors in your specific neighborhood, and thin outside a few coastal cities. App Store reviewers say it prioritizes "aesthetics over usability" and admit they *still use Google Maps as the actual system of record* for private lists, treating Corner only as a place to find spots. The lesson: Corner validated the appetite for taste-over-ratings *and* demonstrated the failure mode of trying to reach it through crowdsourced breadth. this.is's hand-vetted model is the deliberate inversion — it does not need contributor density to be excellent in a new city; it needs one curator.

**Beli — gamified ranking, food-only, its own cold-start.** Beli is the category's breakout, but it is a fundamentally different job: a competitive, gamified restaurant diary. It ranks via a **chess-like Elo system** and layers on city, global, and even school leaderboards. Scale: **75M+ total reviews across 30,000 cities** (Sept 2025), ~80% of users under 35, growth by referral; it has raised ~$6.15M (Series A Nov 2023, G9 Ventures/Goodwater) and declines to disclose DAU. Three structural reasons it does not occupy this.is's ground: (1) it is **food-only** — no bars, listening rooms, cafés-as-rooms; (2) it is a **personal cold-start machine** — useless until *you* have ranked many places, because the value is *your* ordered list, not a curated one handed to a stranger; (3) **leaderboards are the anti-subtraction mechanic** — gamified ranking optimizes for volume of activity, the exact opposite of a short list defined by restraint. Beli proves gamified ranking is engaging; it is on this.is's NEVER list for good reason.

**Foursquare City Guide — the cautionary tale.** Foursquare **sunset its City Guide app on December 15, 2024** (web followed April 28, 2025), folding back into check-in app Swarm and reversing its own 2014 split. This is the single most important comp to internalize: City Guide was a well-funded, once-iconic **UGC local-recommendations guide** — exactly the "crowd will supply the taste" model — and it could not sustain relevance against Google's consensus engine. A broad UGC guide competing with Google on breadth is a losing game. Survival is on the narrow, defensible edges, not the middle.

**Mapstr and the save-app graveyard.** Mapstr (**4M+ users, 90 countries, 90M+ registered places**) is personal-CRM-for-places: excellent storage, zero point of view. It confirms demand for saving but not for discovery-by-curation, and is trivially subsumed by Google's own saved-lists + Ask Maps personalization.

**TikTok / Instagram — the firehose where saves rot.** Worth being precise, because the numbers are frequently overstated. The famous "~40% of young people use TikTok/Instagram instead of Google for local" is **Google's own internal 2022 figure**, still cited but four years old. Current (Jan 2026) data is more honest: 67% of Gen Z rely on social to decide where to eat, and 65% have used TikTok as a search engine — *but only 25% found it effective*, and the share saying they're "more likely to rely on TikTok than Google" actually *fell* from 8% (2024) to 4% (2026) (ALM Corp, 2026-02-26). Social is the top-of-funnel and the proof that room-first, taste-driven discovery is what people chase — they just have nowhere good to put it.

**The empty quadrant.**

| Player | Ranking substrate | Fatal limit for POV / subtraction |
|---|---|---|
| Google Maps / Ask Maps | 300M+ places, review-text consensus | Optimizes for most-supported answer; can't exclude on taste |
| Corner | UGC breadth (~275K) | Cold-start; only as good as local contributor density |
| Beli | Elo + leaderboards, food-only | Gamified volume = anti-subtraction; personal cold-start |
| Foursquare City Guide | UGC guide | **Dead** (Dec 2024) — the model doesn't survive vs Google |
| Mapstr | Personal saves | No POV; storage, not discovery |
| TikTok / Instagram | Algorithmic virality | Firehose; no retention, saves rot |

Map the field on breadth-vs-curation and consensus-vs-point-of-view and every incumbent clusters in the same two quadrants. **High-curation + strong-point-of-view + deliberate-narrowness is empty because it is structurally hostile to everyone above.** Consensus engines can't rank against their own aggregate; UGC apps can't guarantee quality without density; leaderboard apps reward volume, not restraint; save apps have no opinion; social has no structure. Every one of them *scales by adding more*. this.is's thesis is that in the "where's the candlelit room worth leaving the house for tonight" job, the value is in what you subtract. The competitive risk is not that someone out-curates a solo builder; it's the two failure modes the landscape screams about — (1) drifting toward auto-seeded breadth and becoming "a worse Google Maps" (the Foursquare death), and (2) leaning on UGC to fill cities and inheriting Corner's cold-start.

---

## 5. The product & experience

The strategy is sound; the *artifact* is underbaked. Below is a decisive spec for a fully-baked v1, with the spot page — the owner's #1 felt-problem — treated in the depth it deserves.

### 5.1 The feed (Home)

A candlelit masonry: real photographs of rooms, each card image-dominant (5:6) with a bottom scrim, a Fraunces title, an italic one-line curator reason ("the natural-wine room that feels like a friend's kitchen"), a mono walk-time chip ("8 MIN WALK", computed client-side from cached coords), and a floating save bookmark. The feed ranks the curated catalog by a transparent, deterministic, client-scored function of taste-match (from the onboarding vibe vector) plus a proximity bucket plus freshness, with the weights in one exported const. **The honesty contract, borrowed from the design source-of-truth: every card must print its top-scoring factor as its reason line — if the reason can't be stated in six words, the card doesn't rank.** No black-box recall. The grid never shows a spinner or a white box; the placeholder is the venue's stored dominant-color hex block.

### 5.2 THE SPOT PAGE (`/p/g:{place_id}`) — in detail

This is the make-or-break surface. Today it is generic: a name, a chip, a note field, an Open-in-Google-Maps button, and a few related places. That reads as a database row. A fully-baked spot page is an **editorial page worth screenshotting and forwarding** — the single artifact through which taste is transmitted. Top to bottom:

1. **The hero — an owned full-bleed photograph of the actual room.** Not a logo, not a menu shot, not a clip-art plate: the low-lit interior at the hour it's worth going, warm-graded to sit in the Salon Madder palette. The name sits in Fraunces over a bottom scrim; a mono eyebrow reads neighborhood · type · one-word vibe ("WEST VILLAGE · WINE BAR · HUSHED"). There is **no star rating and no review count anywhere on the page** — their absence is a positioning statement. The photograph *is* the argument.

2. **The curator's verdict.** The current one-liner expands into a real short editorial paragraph (~40–80 words, signed by a named curator): why this room earns its place, what it feels like at 9pm, the one specific detail that makes it — the amber light off the bottles, the fact that they'll pour you something off-list if you ask, the back table worth arriving early for. This is the thing people screenshot. Named authorship is load-bearing: a stranger trusts *a person's* judgment, not an algorithm's.

3. **"Who it's NOT for" — the subtraction, made personal.** One or two honest lines: loud after 10 on weekends; cash-only; no reservations, so go early or wait; not a conversation room. **This is the trust-maker no competitor prints**, and it is the wedge rendered at the level of a single venue. The willingness to warn you off is exactly what makes the recommendation credible.

4. **The vitals strip.** Mono chips only: neighborhood, walk/drive time (client-computed from cached coords, *hidden* rather than shown stale past 30 days), price band, and one honest hours line ("LIKELY OPEN TILL 1AM", or — if the hours callable can't be trusted that session — *no open-now claim at all*; honest absence beats a placebo). Then the single outbound door: one pill, **"Open in Google Maps"** (a `query_place_id` deep link). *We curate; Google navigates.* One explicit door, never five ambiguous surfaces.

5. **Save = one tap "want to go."** A madder bookmark commits instantly to the flat want-to-go list; a 5-second undo toast, never a confirm dialog. All fan-out (taste-vector update, counters) happens in a server trigger, never the client hot path.

6. **Below the fold — "MORE LIKE THIS, NEARBY."** A rail of 3–5 *other curated rooms* sharing vibe tags and neighborhood, computed entirely from Firestore with **zero API calls**. The closeup-→-related loop is roughly 40% of all engagement on Pinterest (Pinterest Engineering / WWW'17); the spot page is therefore never a dead end — it is the top of another feed, keeping the visitor inside the taste and turning single discovery into a chain, for free.

7. **Attribution footer** — Google attribution whenever a live Google photo is used (only ever on the long-tail layer's closeup, per Section 6).

**The decisive line on depth (this protects the NEVER list).** Editorial depth stays; transactional depth does not. Describing the room — its story, the one thing to order, who it's not for — is *discovery content* and is exactly what makes the page great. Operating the night — reservations, ticketing, "book now," building an itinerary — is the where-tonight/trip-planner engine on the NEVER list. **We describe the room; we do not run the evening.** That is the bright line that lets the spot page get genuinely rich without drifting.

### 5.3 Onboarding

A vibe-picker whose *only* job is to make the first feed load prove value. The user picks a handful of vibes (seeding the taste vector) and their city; the first feed then paints immediately with real curated rooms ranked to those vibes — never an empty box, never a spinner. If onboarding doesn't hand back an obviously-good first screen, nothing downstream matters.

### 5.4 The save / return loop

Save is intentionally a **flat "want to go" list**, not boards, not folders, not a trip. this.is is a *discovery* product; the save is a lightweight bookmark of desire, and the return reason is *the next room*, not re-managing the last one. The honest return question is "did the feed give you somewhere new worth going," not "how organized is your library." Resurfacing a user's own saves is always permitted but must be *labeled* as such and never disguised as fresh discovery. (This is the deliberate departure from the earlier EMBERBOARD save-app framing: the current direction is discovery-first, so the save is a means, not the product.)

### 5.5 Curator tooling

The founder's daily tool, internal and dead-simple: paste a Google place → autocomplete resolves `g:{place_id}` → the curator writes the POV verdict, the "who it's not for" line, and vibe tags, uploads the owned photo, and publishes to the `curated/*` collection. No CMS ambitions; this is the content pipeline and it must stay a two-minute action so curating 150 rooms is a joy, not a chore. When the franchise motion begins (Section 8), this same tool is what a recruited city curator uses.

### 5.6 What "fully baked v1" means

One city (NYC / Jersey City) impeccable: ~150 curated rooms, each with an owned hero photo, a real curator verdict, and a "who it's not for" line; a spot page that is genuinely editorial and screenshottable; a feed that ranks by vibe + proximity with printed six-word reason lines; save = flat want-to-go with a real return reason; a sibling rail on every spot page; honest hours-or-honest-absence; and — everywhere the curator hasn't reached — an auto-seeded long-tail that is *honestly labeled as such* (Section 6). Ship gates carried from the design source-of-truth: cold first-content under ~1s on a throttled phone; save = 1 tap; the zero-Google-photo grid state explicitly art-directed and screenshotted before launch.

---

## 6. Data & photo architecture

### 6.1 The question, stated plainly

The owner relays an idea from another AI: when a new user opens the app somewhere the database has never seen, do a **one-time ~150-place Google Text Search sweep** of that area, store it, and thereafter serve from the database instead of calling Google on every load. The worry: this contradicts "quality by subtraction" — auto-seeding breadth is exactly the "worse Google Maps" the strategy warned against.

**The decisive answer: yes, build it — but only as a labeled second layer, keyed to a geo-cell (not a user), fired once per cell, and never confused with the curated product.** The sweep is a legitimate, cheap way to keep the app non-empty worldwide. It becomes a betrayal of the thesis *only if auto-seeded breadth is dressed up as curation*. The entire design problem is keeping those two things in separate boxes. This posture already exists in the v2 code (`v2/src/data/candidates.ts`, `v2/scripts/seed-candidates.mjs`) and in the adopted Google ruling (`v2/docs/GOOGLE.md`); the calls below make it explicit.

### 6.2 How the sweep works — and why it's cheap

**The unit of seeding is the geo-cell, not the user.** The existing code derives an ~11 km cell key by rounding coordinates to one decimal place (`cityKeyFrom` → e.g. `40.5_-74.5`) and reads the user's cell plus its 8 neighbors so the feed doesn't die at a boundary. A sweep is keyed to that cell and guarded to **fire once per cell**, amortized across every user who ever stands in it — ten thousand users in Jersey City trigger one sweep, not ten thousand. One sweep = one Text Search query per "vibe family" (the current script runs 12: coffee, dinner, cocktail bars, bakeries, bookshops, etc.), deduped by `g:{place_id}`, yielding ~150 places from a single anchor (the 3-anchor Piscataway default produced 287 real places from 36 calls on its first run). Results write to `cities/{cell}/candidates/{g:pid}`. **Photo resource names are never stored** — only `id`, name, type, neighborhood, lat/lng, a `coordsFetchedAt` timestamp, and a precomputed `photoHex` plate color.

### 6.3 Realistic Google cost and quota (verified 2026-07-02)

Since March 2025 there is no universal $200 credit; **each SKU has its own free monthly allowance** — 10,000 calls for Essentials-tier, 5,000 for Pro, 1,000 for Enterprise (developers.google.com pricing, page last updated 2026-06-29).

| SKU we touch | Rate (0–100K/mo tier) | Free / mo | Role |
|---|---|---|---|
| **Text Search (New), Pro** | ~$32 / 1,000 | 5,000 | the seed sweep |
| **Place Details (New), Pro** | ~$17 / 1,000 | 5,000 | save-time enrichment |
| **Place Photos** | **$7 / 1,000** | **1,000** | live closeup imagery only |

**Seed-sweep economics.** A single-anchor sweep (~12 Text Search Pro calls) ≈ **$0.38 per cell**; the 3-anchor version (~36 calls) ≈ **$1.15 per cell**. The 5,000-call free Pro allowance covers **~400 single-anchor or ~139 three-anchor new-cell sweeps every month, free.** Because cost scales with *new distinct cells activated per month* — not user count — even an aggressive worldwide push into a few hundred new metros a month stays inside the free tier. Text Search is simply not where the money is.

**The real ceiling is photos, not search.** Place Photos is the one Enterprise SKU with only **1,000 free media renders/month at $7/1,000** — the per-project quota that has already bitten this project. At ~3 media per closeup that's only ~330 closeups/month before the meter starts. Every decision below flows from this single asymmetry: *search is nearly free; photo bytes are not; and photo names/bytes cannot legally be cached.*

### 6.4 The decisive model: two layers, never blended

**Layer 1 — the CURATED premium layer (the product and the moat).** The `curated/*` collection: hand-picked ~150 low-lit rooms per launch city, each with a curator verdict and an **owned photo of the room**. Not cell-gated — a curated city guide shows the whole scene ranked by proximity, alive whether you're in the city or an hour out. This is what this.is *is*. Its photos are owned, its editorial is human, and Google contributes only identity (`g:{place_id}`).

**Layer 2 — the AUTO-SEEDED long-tail (scaffolding, honestly labeled).** The `cities/{cell}/candidates` pool from the sweep. It exists so the app is not empty in the thousands of cities the owner hasn't personally curated, and so it can **harvest save-signal that tells the curator where to curate next.** It renders as a visibly distinct, lower-billing row ("nearby / from the wider web"), **never gets a curator verdict, never gets an owned photo, and is never the hero.** The moment auto-seeded breadth borrows the curated layer's editorial voice, the thesis is dead — so the labeling is a *hard product law, not a nicety.* This reconciles the tension the owner felt: subtraction is the *curated* layer's job; the auto-seed layer's job is merely "not blank, and honest about it."

### 6.5 Photos per layer

| Layer | Grid image | Closeup image |
|---|---|---|
| **Curated** | **Owned photo** (owner-shot or venue-provided), fully cacheable, the hero | Owned photo(s) |
| **Auto-seed long-tail** | **Plate art + deterministic jittered hex** (already built in the seed script) — zero photo cost | Optional **live Google photo, ≤3–8/session, attributed, never cached, never on the grid** |
| **User saves** | "Snap it when you save it" — user photo, compounding into an owned catalog | User photo |

Grid imagery is therefore *always* something owned or generated; **Google photos appear only live, only on a closeup, only under a hard session cap.** That is the one configuration current pricing does not punish (the 1,000 free/mo covers dogfooding many times over) and it collapses the photo bill regardless of catalog size.

### 6.6 Staleness, refresh, and ToS

Google's terms are unusually clean on the two things we depend on: **`place_id` is storable indefinitely** (explicitly exempt from caching restrictions), and lat/lng may be retained **30 consecutive days** (non-EEA terms govern, since billing is in Piscataway). **Photo names and bytes may never be cached** — "you cannot cache a photo name; the name can expire." Candidates carry `coordsFetchedAt`; a cell with active users is **re-swept on a ≤30-day cadence** (re-running the sweep *is* the refresh). Cold cells with no recent users age out and are *hidden*, not shown stale. The one gray area to keep on a tripwire list: storing names/types indefinitely technically exceeds the permitted cache list — industry-common, no known enforcement against small apps, and the ≤30-day re-sweep keeps it defensible, but watch it.

### 6.7 Worldwide expansion

- **Curated layer expands city-by-city, owner-paced** — deliberately slow, because slowness *is* the quality signal.
- **Auto-seed gives instant baseline coverage everywhere** — a user in Lisbon or Osaka opens to a non-empty, honestly-labeled long-tail rail on first run, while their saves quietly tell the owner whether Lisbon is worth curating.
- Owned photos only ever follow curation; the long-tail everywhere leans on plate/hex + closeup-only live Google. No hardcoded city; language follows the device; autocomplete is *biased* toward (never restricted to) the user's coords.

### 6.8 The Foursquare-OS / Overture escape hatch

Neither open catalog solves the photo problem — **FSQ OS Places (~108M POIs, Apache-2.0) and Overture (~72M+, CDLA) both contain zero photos.** What they *do* buy is independence from Google for **identity, coordinates, and category** on the long-tail layer and any future map. The cheap insurance: **store a matched `fsq_place_id` alongside `g:{place_id}` at seed/save time** (a one-time conflation against the monthly FSQ OS parquet). That converts a forced future migration from a 6–10-week crisis into a 2–4-week hybrid switch. Do the shadow key now; defer the actual cutover; watch Overture's `categories` removal slated for September 2026 (target `basic_category` from day one).

### 6.9 What to build now vs. later

**Now:**
1. **Keep seeding as the owner-run script** (`seed-candidates.mjs`), one launch city at a time. At n=1 dogfood plus a handful of cities, a hand-run script is strictly simpler than a Cloud Function, has zero abuse surface, and the owner *wants* to eyeball each new city anyway — that's the curation-first instinct.
2. **Ship the two-layer separation and labeling** (curated hero row vs. honestly-labeled long-tail row). This is the load-bearing decision.
3. **Photo fallback chain:** owned/user photo → plate art → hex block; live Google closeup-only, ≤3–8/session, attributed.
4. **Write the `fsq_place_id` shadow key** at seed time.
5. **Set GCP budget alerts at $10 and $50; add a hard per-session photo cap** (both one-line constants).

**Later — build the on-join Cloud Function only when real signups arrive from un-seeded cities.** Design: client sends coords → callable/Firestore-triggered function computes `cellKey` → checks `cities/{cell}/_meta.seededAt`; if absent *and* a transaction/lock claims the cell, it runs the sweep **server-side with the IP-restricted server key**, writes candidates + meta, sets `seededAt`. It must be idempotent (fire once per cell), authenticated and rate-limited (against spoofed/abandoned coords and thundering herds), and capped by a **global monthly new-cell budget** — past N new cells/month it refuses and degrades to honest "no coverage here yet," never a surprise bill. Pair it with a scheduled ≤30-day re-sweep of active cells. The auto-function solves an *unpredictable-worldwide-join* problem the app does not have until it has real inbound traffic; building it before then is speculative scale work. Building the layer separation before then is the thing that actually protects the thesis.

---

## 7. Vision, goals & success metrics

**The change-in-the-world bet:** as answers become infinite and free, the scarce, valuable thing is *editorial refusal* — a human who has been to the rooms and stakes a reputation on a short list. The change we want: going out becomes *intentional* again for the people who want that, instead of defaulting to the highest-rated tourist consensus.

**Honest success metrics (vanity saves are a trap — a save is a cheap "maybe" any save-app can inflate).** The metrics that actually prove a stranger *trusts the taste*:

| Metric | Why it matters | What "working" looks like |
|---|---|---|
| **Discovery-return** (D7/D30 return specifically to *discover*, not to manage a list) | Proves the feed itself has pull | Users come back for the next room |
| **Save-through / went-rate** | A save is noise; *going* is the signal | High save→visit conversion; low save-and-forget |
| **Share / screenshot rate per session** | The truest signal of trusted taste — you only forward a list you'd stake your own reputation on | Cards built to be screenshotted; each share = free distribution + a trust vote |
| **"Left-off" trust** (do users cite what's *missing* as why they trust it) | The wedge is subtraction; no competitor even measures this | Qualitative but load-bearing — track in interviews |
| **City coverage depth × quality** (not city count) | Expansion is real only if each city stays impeccable | ~150 hand-vetted rooms per live city, no filler |

Explicitly **not** goals (per the NEVER list): DAU-maximizing feeds, streaks, leaderboards, becoming a save-organizer, a trip planner, or a where-tonight decision engine. One job: discovery.

---

## 8. Moat, risks & roadmap

### The moat — and its honest weakness

**Defensibility:** (1) **Taste as a brand** — the moat is not the 150 places (Google has all of them); it is the *authority of the judgment*, being the name someone says when a friend asks "where do I go." A competitor copying your list inherits your choices but not your credibility. (2) **The owned inventory is the thing incumbents can't buy** — hand-vetted rooms and owned venue photography (Google = 0 hero pixels) are unclonable by a consensus engine, which is why the owned-photo plan is strategically correct, not just a ToS workaround.

**The weakness, stated plainly:** *curation is founder labor, and founder labor does not compound.* Every new city is ~150 rooms one human must physically vet — O(n) sweat with no economy of scale, the opposite of a data network effect. If the moat stays "the founder's legs," the ceiling is one person's calendar and the product is a great blog, not a great company. Two paths raise the ceiling: **(a) recruit one curator per city** — convert the taste-brand into a *franchise of trusted local curators*, each owning ~150 rooms, making the unit of expansion "find one great curator" rather than "founder flies to a city"; **(b) the taste-agreement graph** — once enough users express agreement/disagreement with curators' calls, learn which curator's taste predicts a given user's and route them to the curator they'll trust. That matching layer *does* compound with users and is genuinely hard to copy, without becoming a UGC review pile (Google's game, where you lose).

### The roadmap (solo builder, Piscataway NJ, ~45 min from NYC, Firebase)

- **Phase 1 — One city, impeccable (now → launch).** NYC / Jersey City only. Make the ~150 curated rooms and, above all, the **spot page** genuinely great (Section 5.2). Depth over breadth. Ship nothing to a second city until city one is something you'd stake the whole brand on.
- **Phase 2 — The 30-day recruit-a-curator tripwire.** Within 30 days of a real launch, attempt to recruit *one* second-city curator (not necessarily launch that city — just prove the franchise motion exists off the founder's own legs). **Tripwire:** if you can't recruit one credible curator who shares the taste bar in 30 days, the "network of curators" moat is unproven and you must *deepen city one* rather than fake breadth. This is the honest fork between "great company" and "great blog," surfaced early and cheaply.
- **Phase 3 — Deepen or expand, decided by the tripwire.** If curator recruiting works, expand city-by-city on the franchise model and start building the taste-agreement graph. If it doesn't, double down on being the undisputed authority for one city and let the brand — not the map — be the product.

### Monetization — honestly, later

Order of operations is non-negotiable: **brand → trust → distribution → revenue.** Revenue before trust is the fastest way to become Yelp. Ordered by fit: **venue partnerships** (most natural, most dangerous — *any* pay-to-be-listed destroys the "trust the omissions" wedge; only viable as clearly-marked, non-ranking-affecting features or post-discovery services, never ranking influence); **premium/membership** (early access to newly-added rooms, off-menu curator notes, new-city unlocks — fits the "be early to the room" psychology without corrupting the free core); **paid/white-label curation** (city guides for hotels, brands, publications — monetizes the founder's judgment without polluting the consumer feed).

### Biggest risks, each with a tripwire

- **Google absorbs the niche** (Ask Maps ships a "hidden gems / low-key" mode). *Tripwire:* if Google ships taste-*subtraction* (not just breadth), the differentiator is *owned inventory + named-curator credibility*, not the list itself — lean entirely into the human-authority and owned-photo moat Google structurally won't replicate.
- **Curation doesn't scale past the founder.** *Tripwire:* the Phase-2 30-day second-curator test. Fail it → deepen, don't expand.
- **Cold-start / no distribution** (a small opinionated list has no SEO and no UGC flywheel). *Tripwire:* if share/screenshot rate per active user stays below a set bar (e.g. <15%) after launch, the cards aren't trusted-forwardable and the spot-page work isn't done — fix the artifact before spending on growth.
- **Feature creep back into the NEVER list.** *Tripwire:* any feature not directly serving discovery is cut on sight; the NEVER list is a moat, not a limitation.
- **Total dependence on Google for identity/photos.** *Tripwire:* owned photography must cover 100% of hero images before a city is called "launched"; keep the FSQ-OS/Overture escape hatch warm (shadow `fsq_place_id`) so a single ToS change can't dark the product.
- **Photo-budget dependency** (the failure that degraded v1 into clip-art). *Tripwire:* if under ⅔ of visible cards show real photos in dogfooding, pull user-photo upload forward; keep hex-first design + owned-plate art as the brand floor.

---

## 9. Open questions for counsel

The direction is fixed; these are the genuine decisions the owner should get outside input on before committing build time.

**Strategy / moat**
1. **Curator-network economics:** what does it actually take to recruit and retain one credible per-city curator, and what comp model (equity, rev-share, status/access) keeps their taste honest rather than pay-to-play?
2. **Is the taste-agreement graph a real compounding moat** at achievable scale, or does useful curator-to-user matching need more users than a niche discovery product will ever have?
3. **The venue-monetization line:** are *any* venue-paid surfaces survivable without corroding "trust the omissions," or does the brand require zero commercial relationship with listed rooms?
4. **Does Google Ask Maps (or a fast-follower) ship a "hidden gems / low-key" subtraction mode** — and if so, is owned photography + named-curator authority actually enough differentiation, or does the niche collapse? (Worth actively monitoring as Ask Maps expands to desktop and new markets, and whether it exposes any creator-list / curated-collection surface that encroaches on the curation quadrant.)

**Product / the spot page**
5. **What makes the spot page "genuinely great" enough to be screenshotted and forwarded** — is owned photo + curator verdict + "who it's not for" sufficient, or does it need what-to-order / event depth that risks drifting toward the NEVER list? (This brief's decisive line: editorial depth yes, transactional depth no — pressure-test that line.)
6. **What is the honest minimum-viable share/screenshot rate** that proves "trusted-forwardable taste," and how is it measured before there's enough traffic to be statistically meaningful?

**Data / photo architecture**
7. **Where exactly does the auto-seed long-tail row sit in the UI, and is its save-signal actually read** by the owner as a curation-prioritization queue — or does it just accumulate unused? The layer only earns its keep if it feeds the curation pipeline.
8. **What is the acceptable global monthly new-cell seed budget** before the on-join function refuses and degrades to honest-absence? This caps worst-case Google spend *and* how fast the app fills in worldwide — a launch-risk dial the owner must set.
9. **Does a plate/hex-only long-tail row (no photos) read as "honest scaffolding" or as "broken/empty"** to a first-time user in an un-curated city? Needs a real art-direction pass and a screenshot before it's trusted as the worldwide default.
10. **Is the ~11 km cell the right seeding granularity** for dense metros (a Manhattan user may trigger only their own cell and see thin coverage) vs. sparse areas? May need a metro-aware anchor list rather than pure coordinate rounding.
11. **What is the actual user-photo attach rate during dogfooding?** The "owned photos become the moat" bet rests on it; below ~40% the plan shifts to owner-shot plates + Wikidata P18 backfill (per the GOOGLE.md tripwire).
12. **Confirm the current per-minute/per-day Place Photos rate quota** (distinct from the 1,000/mo free allowance) that previously throttled the project, so the hard session cap is set below it rather than guessed.

**Unverified facts to nail down before quoting externally**
13. The **"500M reviews" figure for Ask Maps** could not be confirmed (public sources: "300M+ places" + "reviews from the Google community," no review count). Corner's **current active-user count and any 2026 funding** are unverified (only ~275K locations and 2024's $3.75M are confirmed). Beli's **DAU** is undisclosed. And there is no hard public figure for **how many social-discovery saves convert to visits** — the "saves rot" claim is directionally well-supported but lacks a conversion number.

---

## Sources

- Google Ask Maps launch (Mar 12 2026; 300M+ places; Gemini reads full review text): blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/ (2026-03-12); macrumors.com/2026/03/12/google-maps-gemini-integration/ (2026-03-12); cnbc.com/2026/03/12/google-brings-more-gemini-ai-to-navigation-with-ask-maps-feature.html (2026-03-12); kgidealersolutions.com/resources/google-ask-maps-reviews-ranking-now (2026).
- Corner ($3.75M; ~275K UGC locations; refused to scrape; "digitizing word of mouth"; uses Claude): benzatine.com/news-room/corner-the-gen-z-map-app… (2024–25); peopleofcolorintech.com/articles/corner-is-the-new-social-travel-map… (2025); App Store reviews, apps.apple.com/us/app/corner-curate-share-places/id1668282277.
- Beli (Elo + leaderboards; food-only; 75M+ reviews / 30,000 cities, Sept 2025; ~80% under 35; ~$6.15M Series A Nov 2023; DAU undisclosed): en.wikipedia.org/wiki/Beli_(app); foodnetwork.com/fn-dish/news/beli-app-trend (2025); today.com/food/trends/what-is-beli-app-rcna217748 (2025); pitchbook.com/profiles/company/509955-85 (2026).
- Foursquare City Guide sunset (Dec 15 2024; web Apr 28 2025): foursquare.com/city-guide-sunset/; neowin.net/news/foursquare-announces-that-its-shutting-its-city-guide-app… (Oct 2024).
- Mapstr (4M+ users, 90 countries, 90M+ places): en.mapstr.com/.
- Social-search behavior: amaboston.org/gen-zs-new-search-engine… (Google 2022 internal ~40% figure); almcorp.com/blog/gen-z-tiktok-google-preference-drop-2026-data/ (2026-02-26); investors.sproutsocial.com/news… Gen Z 41% social-first vs 32% search (2025).
- Word-of-mouth / trust: pos.toasttab.com/blog/on-the-line/restaurant-reviews-and-ratings-data (2025, WOM 24% > Google 19%); buyapowa.com/blog/88-of-consumers-trust-word-of-mouth/ (2025).
- Google Places API pricing & ToS (per-SKU free tiers; Text Search ~$32/1k, Photos $7/1k @ 1,000 free/mo; place_id storable indefinitely; lat/lng ≤30 days; photo names never cacheable): developers.google.com/maps/billing-and-pricing/pricing (page updated 2026-06-29, fetched 2026-07-02); safegraph.com/guides/google-places-api-pricing/ (fetched 2026-07-02).
- Open catalogs (zero photos): FSQ OS Places (~108M POIs, Apache-2.0) and Overture (~72M+, CDLA), per v2/docs/GOOGLE.md citing docs.foursquare.com + Overture release notes (fetched 2026-07-02); Overture `categories` removal slated Sept 2026.
- Pinterest closeup→related loop ≈40% of engagement: Pinterest Engineering / WWW'17 "Related Pins" (via MAKEOVER.md, sourced-unconfirmed).
- Internal: v2/DIRECTION.md (the fixed direction + cut list), v2/DESIGN.md (Salon Madder visual language), v2/docs/GOOGLE.md (Google ruling), v2/src/data/candidates.ts, v2/scripts/seed-candidates.mjs + seed-curated.mjs (cell-keyed long-tail pool + curated catalog); g:{place_id} identity ruling, NEVER list.

*Confidence flags: sweep cost math, the "consensus ranking converges on the touristy default" argument, and the two-layer / spot-page design calls are analysis/design synthesis, not cited empirical findings. The "500M reviews" Ask Maps figure, Corner's current traction, Beli's DAU, and a hard saves-to-visits conversion rate are unverified (see Q13).*
