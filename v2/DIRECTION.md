# DIRECTION — this.is v2 (adopted 2026-07-02)

> this.is the candlelit end of going out — a hand-curated, taste-ranked feed of the intimate, low-lit rooms near you that are worth leaving the house for, not the 2,000-review tourist default.

**The bet:** Win discovery by SUBTRACTION inside one self-selecting scene: hand-curate the low-lit going-out places (wine bars, listening bars, cozy cocktail dens) one city at a time, so a stranger's very first feed is ~150 genuinely great rooms with owned, on-brand photos — the one thing Google's review-count consensus and Corner's empty cold map structurally cannot hand a stranger on day one.

## 1. The verdict

Build **THE NICHER**: one self-selecting aesthetic scene — the low-lit, intimate end of going out (natural-wine bars, listening bars, cozy cocktail dens, late aesthetic cafés) — hand-curated, taste-ranked, one city at a time, shipped as a **public** discovery feed. Two of three judges picked it outright (switch 40/50; shipwright 41/50); the moat judge picked the Taste-Graph but *only* when launched inside this exact scene — so all three converge here. It wins because its cold-start cannot structurally fail (anyone who opens "the candlelit end of going out near me" already shares the house taste, so one hand-ranked list fits nearly everyone with zero data), it is the only entrant whose photo problem is genuinely solved rather than finessed, and it is the one a solo builder can ship in weeks and sustain after. I absorb the three grafts every judge demanded: the Aesthete's single grading pipeline, the Curator's honest-degradation rule, and the Taste-Graph's named-lens + save-affinity seed (taken **without** the two-sided marketplace).

Decisive: this is a **pivot of the existing v2 build, not a third repo**. v2 already ships the chassis — `v2/src/data/ranking.ts` (a transparent taste+proximity+freshness scorer that prints a six-word reason on every card), the vibe onboarding (`vibes.ts` / `Onboarding.tsx`), a discovery card + candidate pool, and, decisively, `v2/DESIGN.md`'s "SALON MADDER" language, whose Law 1 ("ONE photo grade over every Google/user/AI image") **is** the Aesthete's grading pipeline already designed, and whose deep-oxblood salon-gallery room **is** the low-lit scene's aesthetic. The engine is currently built save-first; we repoint it discovery-first.

## 2. Positioning + the wedge

The wedge: **discovery is a subtraction problem, and in mid-2026 every incumbent bets the other way.** Google's "Ask Maps" (Mar 12 2026) synthesizes 300M places and 500M reviews with Gemini — statistically that surfaces the most-reviewed, i.e. the tourist-trap consensus; it structurally cannot say "skip the famous one." A solo builder cannot out-index that. But ~150 hand-vetted low-lit rooms with a stated opinion is a thing one person can make *embarrassingly* good, and it is exactly what infinite-catalog AI cannot fake, because a point of view requires a human willing to leave places off.

## 3. The MVP — the smallest genuinely-good v1

- **The curated catalog.** Hand-key 40–60 venues to start (grow toward 150–250) in the launch metro, in `places/{g:pid}`, each carrying: a one-line curator POV that includes the *exclusion* ("the negroni bar pretending it's a bookstore — we skipped the famous one two doors down"), 2–4 vibe tags, neighborhood, and 1–3 **owned** ambiance photos in Firebase Storage.
- **The discovery feed = Home.** Repoint `ranking.ts` to score the **curated catalog** (not the user's pins), gated behind the vibe-picker, each card leading with the POV line and the honest reason line ("because you save wine bars," "6 min away"). This is the whole product surface.
- **Onboarding vibe-picker,** scoped to the niche: natural wine / cocktails / listening bar; silent / lively; solo / date. ~20 seconds, seeds the taste vector, personalization is a *re-rank on an already-good editorial set*.
- **Save = one flat "want to go"** bookmark that teaches the taste vector and visibly sharpens the reason lines (the single-user affinity loop). No boards, no board picker.
- **Honest degradation:** outside the one curated city, "we haven't curated here yet" + the raw seeded/Google long tail, labeled and unranked — never faked.
- **One named house lens.** Ship the curation under a real, named human voice (the founder, honestly — not a fake persona). This is the seed that makes city #2 "recruit one curator" instead of "clone my labor," and the architectural hook for the agreement-graph later.

## 4. The CUT LIST (this overrides v2/CLAUDE.md's "never cut" order — the direction changed)

- **Save-first framing — DEMOTED, hard.** The MAKEOVER/v2 thesis ("going is what makes your boards beautiful," Been-per-Want as the success metric) **dies.** Home is a discovery feed, not a saved-portfolio. Metric becomes discovery return + save-through, not Been-per-Want.
- **TONIGHT rail — CUT** (`TonightRail.tsx`, `tonight.ts`). It's a "where tonight?" *decision engine* the owner explicitly ruled out, and it ranks over *your own saved pins* — dead cold for a stranger. Keep only its useful atoms (time-of-day + proximity) as inputs to the *one* discovery feed's ranking; kill the surface.
- **Morning-after card — CUT** (`MorningAfterCard.tsx`, `goEvents.ts`). It's the save→visit→log retention loop — the Beli-style journaling paradigm discovery rejects; depends on a GO to a saved place.
- **Boards — DEMOTED** to a single flat "want to go" list (`boards.ts`, `Board.tsx`, `BoardPickerSheet.tsx` collapse; `Saved.tsx` becomes one flat list). Organizing saves is a save-manager, not discovery.
- **Trip mode / dated itineraries / per-day grouping** (the recent v1 commits) — **CUT.** Not discovery.
- **DMs / messaging / unread App Badge / "still want to try?" rail** — **CUT** (already on v2's NEVER list; stays dead). A social graph is Corner/Beli's game and is dead weight cold.
- **Search — DEMOTED** behind an icon (minisearch scoped to the catalog + a Google autocomplete lane for "add a place"). Legacy `explore_stacks` / `StackDeck` / `SearchV2` — **killed.**
- **KEEP as strategic assets:** the ranking engine + reason lines, the vibe onboarding, the SALON MADDER aesthetic + its single photo grade + beautiful-on-purpose hex placeholders, `g:{place_id}` identity, and the seeded candidate pool (now the long-tail fallback).

## 5. Data + photo ruling (decisive)

**The `v2/docs/GOOGLE.md` legal spine stays; its photo *bet* changes.** That ruling's "snap it when you save it" (user-photos-as-primary) was built for a *personal save-app* — it structurally fails public discovery, because a stranger's first feed has zero user photos. The niche fixes this:

- **Hero/grid imagery = OWNED, always.** Self-shot + venue-supplied ambiance photos, hosted in Firebase Storage: fully cacheable, $0 per render, zero Google ToS exposure. Image-conscious wine/listening-bar venues *want* their room photographed — so this is a distribution win, not a Google dependency. The niche shrinks the surface (150–250 venues, not millions) to something one founder 45 minutes from the venues can own. **This is the whole reconciliation of the owner's Google discomfort: the discomfort was about renting stock exteriors per-render (the clip-art problem); the felt product now rests on Google for zero hero pixels.**
- **Identity + long-tail lookup = Google, kept.** `g:{place_id}` (storable forever, legal, kills the identity crisis) + autocomplete/Details for adding places (near-free at dogfood scale per GOOGLE.md's own math). Google photos survive only as a **closeup-only, live, attributed, budget-gated** fallback for the *uncurated* long tail — never on the grid, never cached. One display grade (DESIGN.md Law 1) makes owned + venue + fallback read as one magazine; the poster/hex fallback makes a photoless venue look intentional.
- **FSQ/Overture catalog ownership — DEFERRED, not built.** Judge 2 is right: the "shadow key already exists" claim is effectively false — `fsqId?` in `v2/src/data/types.ts` is an empty placeholder; owning the catalog is real ingestion work. The niche means you hand-key anyway. Keep `fsqId?` as the documented one-script escape hatch; do not build the pipeline for MVP.
- **Worldwide** = the app *works* anywhere (global-first code, no hardcoded city) while curated *depth* expands city-by-city. Worldwide is the expansion path, not a day-one coverage claim.

## 6. Cold-start — great for user #1, day one

Self-selection is the trick: the floor is the founder's judgment, not a cold model, so there is no empty/generic first session. Vibe-picker → the launch city's hand-built catalog, re-ranked to the chosen vibes, every card a real room with a real owned photo and a POV line. First save sharpens the reason lines immediately. No friends, no history, no saves required.

## 7. Differentiation (2026 facts)

- **Google "Ask Maps"** (Mar 2026, Gemini over 300M places / 500M reviews): consensus-average, optimizes for review count = the busy/touristy option, no POV, permanently gray. We answer the question it can't: "what near me is intimate and on my vibe" — and we exclude.
- **Corner** (~55–96k users, 4.5★, ~$3.8M raised, "search engine for vibes," TikTok/IG import): closest rival, but crowd/UGC + friend-graph dependent, so a cold stranger gets a thin, near-empty map; documented "forced social" and empty-pin bugs; imagery is a camera-roll dump. We are authored, great with zero friends, one house grade.
- **Beli** (75–80M+ reviews, 4.9★, 80% under 35): a gamified food *ranking/logging* journal with leaderboards + streaks; food-only, backward-looking, cold-start "not worth it without friends." We have zero ranks/streaks and are forward-looking bar/ambiance discovery.
- **Foursquare City Guide:** dead (Dec 2024) — the cautionary tale: don't be a worse Google Maps with social bolted on.
- **TikTok/IG saves** (~40% of Gen Z primary search): the discovery firehose, but saves rot unranked and un-located. We ingest that impulse and rank it "near me, for my taste."

## 8. Build sequence — first 2 weeks, on the v2 engine

**Week 1 — the pipeline and the catalog (build the grade FIRST; it IS the moat).** (a) Confirm/finish the single display-time grade over `PinVisual`/`photos.ts` so a self-shot photo, a venue photo, and the hex fallback read as one magazine (DESIGN.md Law 1/6 — mostly designed). (b) Extend `places/{g:pid}` with `curatorPOV`, `vibeTags[]`, `ownedPhotoPath[]`; keep `fsqId?` dormant. (c) Hand-key the first 40–60 low-lit venues in the launch metro; shoot/source + upload 1–3 ambiance photos each.

**Week 2 — repoint and cut.** (a) Change `ranking.ts`'s input from the user's pins to the curated catalog; make the POV line the card hero; gate on the niche-scoped vibe-picker. (b) Rip out `TonightRail`/`tonight.ts`, `MorningAfterCard`/`goEvents.ts`, `boards.ts`/`Board.tsx`/`BoardPickerSheet`; collapse `Saved.tsx` to one flat "want to go"; remove trip mode; demote search. (c) Wire honest degradation + the closeup-only, attributed, budget-gated Google fallback. Then put it in front of ~20 taste-driven strangers in the launch metro and watch the one validating signal: do they screenshot/share a card, and re-open within the week.

## 9. The one biggest risk + the tripwire

**Risk:** curation is 100% founder labor and does not compound — the ceiling all four strategies share. Growth stalls at 1–3 cities, and a funded Corner (80k curators, a follow graph) could narrow into this exact scene. The named-lens + save-affinity seed is the *only* thing keeping a Series-A ceiling alive, and it is unproven.

**Tripwire:** once the launch city is stable, try to recruit **one unpaid local scene-curator to author a second-city lens within 30 days.** If that fails, the "recruit one curator per city" expansion engine does not exist — stop spending runway on breadth, deepen the single city, and test venue-partnership or paid curation before adding any city #2.
