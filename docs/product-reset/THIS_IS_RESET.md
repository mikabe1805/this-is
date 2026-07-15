# this.is — Product Reset

**Decision date:** July 10, 2026  
**Status:** Canonical product direction  
**Working promise:** **Find the place your people already have a truthful reason to choose.**

## Executive decision

The detailed interaction contract now lives in [UX architecture](./UX_ARCHITECTURE.md).

> **Group-native amendment, July 11; owner discovery decision, July 14:** [`GROUP_DIRECTION.md`](./GROUP_DIRECTION.md) supersedes the
> pair-first scope retained in this historical reset narrative. Persistent groups of 2–6 are now
> the primary object; a pair is the smallest valid group. A member-only, permission-versioned read
> boundary, consented membership/exact-sharing lifecycle, attendee-aware recommendation, and durable
> group Pick now exist locally. Keep also has an explicit-area, private taste-guided discovery action
> so a person can find and review places before a family plan. Production remains legacy until every
> reviewed cutover gate passes. Location targeting is explicitly outside the product contract.

this.is should become the **shared taste layer for real-world places**: a small-circle product that remembers who wanted, tried, or loved a place, preserves the useful note behind the recommendation, and reveals where two or more people's tastes overlap.

It is not another map, public review network, editorial city guide, personal Pinterest for places, or restaurant-voting game. Google and Apple own maps and logistics. Corner owns broad Gen-Z social place discovery. Beli owns gamified restaurant ranking. A growing field of small apps already asks every group member to swipe or vote from scratch.

this.is has a sharper opening:

> **No polling by default. No 40-message restart. Your shared history may already contain a truthful reason.**

The existing `/with/:uid` Overlap concept proved the strongest underlying idea in the project's
history: accumulated shared taste can answer a real decision. The approved center generalizes that
idea to named recurring groups rather than treating one-to-one intimacy as the entire product.

## What happened to the project

The project accumulated code, but the deeper problem was repeated changes to the job it was trying to do.

1. **Original app / v1:** a broad social discovery platform with places, hubs, posts, lists, profiles, follows, activity, messages, rankings, maps, trips, and recommendations.
2. **MAKEOVER direction:** a personal “candlelit save-layer above Google Maps,” centered on boards, Want-to-Been conversion, Tonight, and morning-after logging.
3. **Separate `C:\Users\mikus\this-is-v2`:** a clean-room implementation of that personal board/save thesis.
4. **In-repo `v2/`, editorial phase:** a founder-curated guide to low-lit rooms, using “discovery by subtraction.”
5. **In-repo `v2/`, friend phase:** Want / Tried / Loved, a friend feed, friend notes, and pairwise taste overlap.

Each direction contained good work. Together they produced contradictory copy, data models, navigation, and success metrics. The current signed-out v2 Home says “Where your people actually go” while primarily showing an impersonal low-lit catalog. That is the project problem in one screen.

## Codebase ruling

### Canonical base: `this-is/v2/`

Use the in-repo v2 as the rebuild base because it already contains the friend-save model, invites, friend feed, place-level social proof, and the pairwise Overlap route. It is compact enough to reason about and currently builds successfully.

- Original `src/`: 138 source files, about 31,357 lines.
- In-repo `v2/src/`: 45 source files, about 5,139 lines.
- Separate `this-is-v2/src/`: 40 source files, about 4,002 lines.
- Both v2 implementations passed production builds during this audit.
- The active branch is 114 commits ahead of `main`, which explains why the repository's official history no longer describes the live product accurately.

### Disposition

- **Root v1:** freeze as historical/reference code. Do not continue feature work there.
- **In-repo `v2/`:** canonical product and implementation.
- **Separate `C:\Users\mikus\this-is-v2`:** archive after extracting only clearly better primitives or test coverage. Do not merge architectures wholesale.
- **Firebase:** keep the existing project for now, but use explicit v2 collections and locked rules. Avoid another migration until the product loop is validated.

## Product definition

### One sentence

**this.is helps people build truthful place taste, then helps a recurring group find where to go.**

The group promise remains: **this.is helps a recurring group find the place it already has a truthful reason to choose.** Personal discovery builds the evidence that makes that promise useful; it does not replace it with a generic recommendation feed.

### The job

When a recurring group of 2–6 is choosing somewhere, show at most three places supported by the
current attendees' explicitly shared taste—without making everyone research, swipe, rank, or repeat
recommendations already buried in messages.

### The atomic object

A place is not valuable because it exists in a catalog. It becomes valuable when it carries a trusted relationship edge:

- **Person:** who saved or recommended it.
- **Signal:** Want, Tried, or Loved.
- **Context:** a short note such as “quiet enough to talk” or “skip Friday after 9.”
- **Use:** a moment or mood, not a generic taxonomy.

The product's moat is the growing graph of **person × place × signal × context**, not the place database itself.

## The core loop

1. **Discover or Keep:** Name a place you know or explicitly search one temporary area, then save the reviewed place as Want, Tried, or Loved. Add a short note only when useful.
2. **Group:** Create or join one recurring group of 2–6 through explicit, one-person invitations.
3. **Share deliberately:** Keep stays private until a person shares an exact place or optional broad
   hint with that specific group.
4. **Reveal:** Together returns zero to three exact matches, named member introductions, or bounded
   weak fits with truthful supporters and unknowns.
5. **Pick:** The group confirms one bounded Pick; no swipe deck or compatibility score is required.
6. **Go:** Hand off directions and navigation to Google Maps.
7. **Learn privately:** After a visit, each attendee may independently Keep Tried or Loved. No streaks,
   public score, or manufactured group outcome.

## Information architecture

Keep three primary destinations:

### Together

The front door. Choose one recurring group and see only authoritative state: current Pick, Last Pick,
forming status, or exact shared-signal count. Opening a group shows:

- the current membership audience and actual attendees;
- zero to three candidates from explicitly group-visible evidence;
- exact support, named introductions, and unknown-member counts;
- one reversible selection followed by an explicit group Pick commitment.

This replaces the generic discovery feed as the product's front door.

### Keep

Your compact place memory: Want / Tried / Loved, searchable, with notes and source attribution. When
nothing comes to mind, Discover uses one temporary typed area and locally ordered broad categories to
open the same reviewed save flow. This is the single-player floor and the data that powers Together.

### People

The accepted people in explicitly shared groups—not follower counts or public profiles. One shared
group opens directly; several remain separately named destinations. Search/Add remains a global action
rather than a fourth primary tab.

## Experience principles

1. **People before places.** Every recommendation should answer “whose judgment is this?”
2. **Three good answers beat an infinite feed.** The product reduces choice instead of manufacturing scrolling.
3. **History before polling.** Ask for new input only when the graph cannot make an honest recommendation.
4. **Context beats ratings.** Keep the short note; omit stars, public review counts, influence scores, and leaderboards.
5. **Honest cold start.** With no group evidence, this.is offers optional contribution and invitation
   recovery—not a disguised editorial feed or false shortlist.
6. **Google handles logistics.** Use Google place identity and explicit navigation handoff; do not rebuild a general map.
7. **Private by default.** Place histories and notes are sensitive social data. A fresh save is private;
   each group audience is explicit and legible.

## Competitive position

| Product | What it owns | Why this.is should not copy it |
|---|---|---|
| Google Maps / Ask Maps | Universal place data, intent search, logistics, saved lists | Google can already answer broad individual queries and turn them into navigation. Competing on catalog or AI search is unwinnable. |
| LLM group chats (ChatGPT, Gemini, Claude) | Zero-install conversational planning inside or beside the chat | They can synthesize a fresh answer immediately. this.is wins only when permissioned standing memory, exact human provenance, and durable outcomes are materially better than an ad-hoc prompt. The Pick must return to the chat as an evidence receipt. |
| Apple Maps | Maps, private place library, shared and editorial Guides | A prettier personal list or curated guide is a feature inside the operating system. |
| Corner | Social discovery, Gen-Z tastemakers, crowdsourced cultural guides | “Friends and vibes on a map” is occupied. this.is must be narrower and decision-oriented. |
| Beli | Restaurant tracking, ranking, sharing, gamification, and pairwise taste matching | Match scores narrow the overlap white space. this.is must prove group-specific evidence, privacy, and decision closure rather than imitate compatibility scoring. |
| Mapstr | Saving, tagging, organizing, and sharing places | Personal place CRM is useful but not sufficient differentiation. |
| The Infatuation | Professional editorial recommendations | Founder-curated city coverage does not compound and is already well served. |
| Swipe/vote pickers | Fast group consensus from a fresh candidate deck | This is a crowded commodity mechanic. this.is should use accumulated taste so the group does less work over time. |

## MVP

### Must ship

- Sign-in, identity, and explicit 2–6-person group membership through bounded one-person invites.
- Want / Tried / Loved with an optional short note.
- Personal Keep view with user-confirmed durable place memory.
- Together as the primary experience: recurring groups, attendee-aware exact matches, named member
  introductions, bounded weak fits, and missing evidence kept unknown.
- At most three candidates with a visible reason and readable sources for each.
- One server-owned current Pick, Maps handoff, visited/dismissed closure, and independent personal
  Tried/Loved follow-up.
- Group-specific sharing, private-by-default saves, and member-scoped Firestore authorization.
- Paste a Google Maps link or search to add a place.
- Personal Discover inside Keep/Add: explicit temporary area, private local taste ordering, one
  session-tokened Google search per prompt, minimal live context, and reviewed private-by-default save.
- Identity-free, bounded instrumentation for candidate density, resolved Picks, and pilot decisions.

### Explicitly not MVP

- public discovery feed;
- founder-curated city catalog as a core surface;
- map page;
- posts, comments, DMs, activity feed, or public profiles;
- boards, folders, itineraries, trip mode, or Tonight automation;
- ratings, pairwise rankings, influence scores, streaks, or leaderboards;
- AI chat or LLM ranking on the hot path;
- group swipe decks or real-time voting;
- paid venue placement.

## Recommendation logic

Start deterministic and explainable. For current attendees, known candidates come only from exact
Want/Loved evidence explicitly shared with this group plus optional broad hints. Temporary category,
area text, and one supported practical need may filter the draft but never create taste support.

Rules:

- Hard vetoes and current-plan filters apply before ordering.
- Exact multi-person support leads; a single Love may introduce a place only with the member named and
  everyone else kept unknown; an exact signal plus another member's broad hint is visibly weak.
- Within an evidence mode, support breadth and Want/Love strength order candidates with stable ties.
- Every result prints its strongest true reason: “All 5 want this,” “Dev loved this; 4 people haven’t
  weighed in,” or “Mika wants this; it fits Vivian’s food hint.”
- If evidence is thin, say so and offer the smallest honest recovery. Do not fill the screen with
  generic nearby places or treat location as taste.

## Success metric

### North star

**Resolved Picks per active group per month** — a current member opens one group decision, the group
commits a Pick, and it later closes as visited or dismissed.

### Leading indicators

- first meaningful save completed;
- first real group invitation accepted;
- first non-empty group shortlist viewed;
- first “Pick for us” result opened in Maps;
- share/invite conversion;
- unprompted second plan from an established group;
- distributed contribution across more than one member;
- percentage of recommendations with a truthful human-readable reason.

Raw saves, feed impressions, follower counts, and session length are not success metrics.

## Build and dogfood before external research

The owner will build and use the development app with their own family rather than recruit a research
cohort. Family dogfooding may guide bugs, comprehension, and product judgment, but it is not represented
as independent research, market validation, consented participant evidence, or production approval.
No research-readiness file is required merely to use the app personally with family members who already
understand the development context.

If the owner later recruits people outside that personal context or wants to make evidence claims, use
[`PHASE_0_CONCIERGE_TEST.md`](PHASE_0_CONCIERGE_TEST.md),
[`GROUP_VALIDATION_PLAN.md`](GROUP_VALIDATION_PLAN.md), and their strict governance/evaluation gates.
Those larger protocols remain optional future research infrastructure, not a prerequisite for continuing
the local build.

## Rebuild sequence

### Phase 0 — stop the drift

- Declare this document canonical.
- Freeze root v1 and the separate v2.
- Replace contradictory v2 strategy documents with historical labels and links here.
- Create a single backlog mapped to the new loop.

### Phase 1 — make Together the product

- Rename Home to Together and route `/home` there.
- Promote recurring-group selection above all place content.
- Show exact matches and named member introductions without false consensus.
- Remove the founder-curated catalog from the default Home experience.
- Reduce navigation to Together / Keep / People.

### Phase 2 — close the decision loop

- Add group-scoped “Pick for us.”
- Add constraint chips only when needed.
- Record an explicit pick and Maps handoff.
- Add post-visit Tried/Loved update.

### Phase 3 — acquisition and trust

- Paste-a-link capture.
- Add one no-install group Pick receipt with privacy-redacted evidence.
- Replace public-readable saves with group-specific server-owned projections.
- Add analytics and deletion/export controls.

### Phase 4 — only after validation

- An approved open-data unfamiliar-place source, only for explicit plan geography and still within the
  final-three ceiling.
- Trust-weighted discovery only after density, privacy, abuse, and comprehension thresholds pass.
- A single reroll or richer temporary constraints only when observed decisions require them.
- No automatic location inference or learned ranking without a new product decision.

## Brand direction

Keep **this.is**. The name works better for a trusted recommendation than for a generic map: “this is the place,” “this is Maya's pick,” “this is where our tastes meet.”

Retain the Salon Madder palette as a recognizable starting point, but remove the forced low-lit/candlelit category positioning. The visual system should feel intimate and human, not like every venue is a wine bar at midnight. Use color and typography to distinguish people and relationships; use real place imagery only when it adds information. The signature visual should be **overlap**—two or more taste fields resolving into a small set of places.

## Sources

- Google, “How we're reimagining Maps with Gemini,” Mar. 12, 2026: https://blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/
- Google, “3 Google Maps updates to make summer travel easier,” Mar. 28, 2024: https://blog.google/products-and-platforms/products/maps/google-maps-updates-summer-travel-2024/
- Apple Maps product page and Guides overview: https://www.apple.com/maps/
- Corner product and City Guides: https://www.corner.inc/ and https://www.corner.inc/guides
- Beli product page: https://beliapp.com/beli-home
- Mapstr product and FAQ: https://en.mapstr.com/ and https://en.mapstr.com/faq
- The Infatuation mobile app: https://www.theinfatuation.com/mobile-apps
- Examples of the crowded group-voting mechanic: https://www.getmunchmatch.com/, https://tablevote.app/, https://www.fuddle.net/

## Implementation checkpoint — July 10, 2026

> **Historical implementation evidence, not current product instruction.** The bullets below preserve
> the pair-era foundation and the sequence by which it was replaced. Use `GROUP_DIRECTION.md`, the
> current sections above, and `CURRENT_STATE.md` for present product and implementation decisions.

The first product-reset slice is implemented in `v2/`:

- `/together` is the default route; legacy `/home` redirects there.
- Primary navigation is Together / Keep / People.
- Signed-out positioning now explains taste overlap instead of showing an anonymous catalog.
- Together starts with an explicit recurring group of two to six people and opens its shared evidence directly.
- Overlap now returns up to three zero-vote candidates with explicit reasons, plus reciprocal “where they can take you / where you can take them” views.
- Onboarding captures identity and optional real Loved places; it no longer asks for abstract vibes or auto-follows demo tastemakers.
- Search is an explicit place-capture utility rather than a zero-query editorial feed.
- The dead generic Home feed was removed.
- v2 Firestore rules now scope saves/notes to the owner and the reader's intentional circle. They are a cutover target only and were not deployed over the live v1 rules.
- The detailed product contract now lives in `UX_ARCHITECTURE.md`: nouns, IA, journeys, state matrix, privacy, recommendation rules, interaction laws, measurement, and visual signature.
- `/with/:uid/plan` closes the loop with context chips, at most three unnumbered candidates, truthful reasons, a reversible selection, and a “not for us” correction.
- Pair views now use a convergence trace as a relationship-specific visual signature rather than relying on generic dark-premium styling alone.
- Group evidence and recommendations use Firebase-independent domain modules covered for explicit visibility, missing evidence, location independence, context filtering, sparse data, deduplication, and the three-choice limit.
- A development-only group fixture exercises the real Together and group-planning screens without authentication, Firebase reads, or Places requests; fixture data is verified absent from production output.
- The stale v2 README was replaced: deleted-feed, demo-tastemaker, and generic discovery claims no longer present themselves as current authority.
- Opening a recommendation creates a minimal attendee-scoped group Pick with its place snapshot, context, and original reason; the place page carries that group context forward.
- A Pick closes exactly once as visited or dismissed. `We went` changes only that shared lifecycle; the visited screen then lets each attendee independently keep Tried or Loved, completing recommendation → decision → experience → stronger memory without manufacturing group consensus. One bounded Last Pick pointer supports return until the next Pick.
- The place page no longer presents the discarded house catalog: low-lit-list labels, curator POV, abstract vibe chips, and generic related-place discovery were removed.
- Group activation uses random, bounded invitation tokens and explicit acceptance. New pair invitations are denied; existing pairs can convert into audience-identical two-person groups.
- The cross-profile follow exception and its list-truncation risk were removed. Connection existence now authorizes pair signal reads, and disconnect immediately removes that access.
- v2 rules include member-scoped historical Pick access, server-only group Pick creation, migrated-pair legacy-read revocation, retired pair creation, bounded signal/group-invite schemas, exact-token-only non-enumerable invite previews, server-only public receipt storage, immutable canonical place facts, immutable evidence/membership, 30-day raw-event retention, and an account-deletion write lock; 80 emulator cases verify the authorization target. The rules remain undeployed.
- Repository defaults now make the decision real: root `dev`, `test`, `typecheck`, `build`, preview, and Hosting-emulator commands target canonical `v2/`; v1 requires explicit `:v1` commands.
- The root README is the version map, stale EMBERBOARD/social-feed/Google-hub documents identify themselves as historical, and `v2/AGENTS.md` prevents future sessions from inheriting the discarded product laws.
- The separate dirty `C:\Users\mikus\this-is-v2` folder received a final read-only extraction audit. Its unique boards, vibe onboarding, service worker, swipe navigation, imports, and tests should not be merged; the owner must preserve and archive that dirty work explicitly.
- The obsolete public shared-board route/rules, editorial curated catalog, taste-vector module, feed card, and board/sheet/Tonight CSS were removed. Search now uses bounded canonical place snapshots plus the explicit Google Add lane.
- The web manifest, metadata, and convergence app icon now carry the actual pair-overlap promise. Hosting-emulator checks prove the root and relationship/invite deep links, manifest, and icon all serve from `v2/dist`.
- Eight write-only milestones now cover the real loop from onboarding and invitation through pair evidence, Pick, and post-visit closure. Rules prohibit client reads and constrain properties to bounded counts and fixed enums, preventing place ids, notes, queries, tokens, names, or relationship identifiers.
- `VALIDATION_PLAN.md` defines the eight-pair, 14-day pilot, early diagnostic reads, observation tasks, interview prompts, proceed/iterate/revise thresholds, a UID-free aggregate summary command, and the anonymous decision evaluator.
- The former direct Google-ID import writer was removed. `MIGRATION_PLAN.md` and a read-only planner now reconcile actual v1 saved markers, list-place status/notes, auto-status lists, legacy place identities, existing v2 signals, and create-only rollback paths without production mutation.
- Eleven production-shaped migration invariants prove explicit/newest-signal precedence, private-by-default import, honest skips for unknown status or identity, existing-data preservation, deterministic ties, rollback scope, and repeat-run idempotency.
- Invitation tokens now expire after seven days, can be revoked before use, disappear from public reads after claim, and cannot be replayed. Security rules require claim and pair creation in the same atomic transaction, preventing a consumed token without its connection or a connection without consent.
- Google Maps link capture now honors official `query_place_id` identity, turns readable long-link labels into a confirmable autocomplete search, rejects coordinate-only guesses, and resolves opaque short links through a bounded authenticated function that cannot leave Google-owned Maps hosts.
- Owner data controls now export every canonical personal-data surface and delete the v2 account with recent-auth confirmation, a server-side write lock, recursive event cleanup, relational record removal, and Auth deletion last. A full Auth/Firestore/Functions emulator test proves the operation; the frozen v1 retention boundary remains an explicit cutover decision.
- The frozen v1 boundary now has a conservative retirement recommendation and a read-only UID planner covering owner records, shared references, threads, analytics, derived taste, denormalized copies, and Storage candidates. Unknown UID references stop for review; owner approval and production reconciliation still precede any executor.
- The production bundle can connect explicitly to local Firebase emulators for whole-flow proof without touching paid Places APIs. A mobile real-browser pass completed invitation, consented connection, truthful overlap, a durable Pick, and Loved closure; it exposed and fixed an inviter-name query race.
- Raw product events now carry a rules-bounded 30-day expiry. The deploy manifest enables TTL without indexing the sequential field, and a rules-backed integration proves authenticated delivery, owner unreadability, immediate summary expiry, and aggregate output containing no identity or place history. The same report derives connected-pair → Pick conversion and 14-day closure from durable connection/Pick records; temporary pair keys never leave process memory.
- The development pair fixture now finishes its cache installation before rendering Firebase-backed routes, eliminating a race where real queries could overwrite seeded evidence during invite → pair navigation. The repaired 390 × 844 flow lands directly on three reasoned candidates with no warnings or overflow.

Verification: root canonical commands, the v2 production build, TypeScript check, recommendation/Pick/data-state invariants, eleven legacy-save migration invariants, pair-to-group conversion invariants, the v1 erasure-planner invariants, 72 Firestore authorization cases, group/receipt lifecycle, owner export/deletion and observability integrations, Hosting deep links, manifest/icon assertions, and `git diff --check` pass. Group creation/invitation, attendee-scoped recommendations, Picks, receipts, explicit pair conversion, and retired pair-link handoffs are the canonical exercised flows. The public receipt also passed a 390×844 browser render with zero warnings. A production-bundle scan confirms that fixture identities, tokens, notes, places, stale public-board/editorial strings, and the lazy fixture chunk do not ship. Production dependencies audit clean; six moderate advisories are isolated to the Firebase emulator CLI's development-only tree.
