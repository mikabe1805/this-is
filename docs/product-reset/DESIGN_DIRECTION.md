# this.is — canonical design direction

**Date:** July 11, 2026  
**Decision:** refine the pair-first `v2/`; do not create another product branch.

## The recovered through-line

The project has changed shape repeatedly, but its durable promise has been consistent:

> Turn scattered place recommendations into a memory you can actually use, grounded in people you trust.

The [original 2024 deck](https://drive.google.com/file/d/1GD_Z2wzwfIk4DkkALCI4F0XMjB2vWPkB) called this **“your memory — outsourced.”** It identified the real problem well: people save recommendations across social platforms, then cannot retrieve or act on them when a decision arrives.

The 2025 documents split that promise into two incompatible products:

- [“This is suggestions”](https://docs.google.com/document/d/1J3gW_eB63laAnHaH_zVvYv_TC30Yvnw1WkAwQaszlPQ) expanded toward hubs, posts, comments, influence, reels, and public discovery.
- [“this.is 2.0”](https://docs.google.com/document/d/1iVotRU7PAnc11CCa2frJXSa4cvNHZ2aPNPRcvL1eZ1A) also proposed a private, Notes-like place memory with Want / Tried / Loved, fast capture, optional notes, and small trusted sharing.

The pair-first reset resolves that split. Keep is the private memory input. Together is the moment that memory becomes useful. A Pick is the small shared object that turns agreement into action and later becomes memory again.

## Product position

**Find the place your people already agree on.**

this.is is not a restaurant-ranking network, public review site, event invitation service, or itinerary builder. It is the private layer between “we should go somewhere” and a specific place that already has a truthful reason to win.

The core loop is:

1. Keep places with Want / Tried / Loved and an optional note.
2. Choose one real person.
3. See mutual taste and reciprocal introductions.
4. Resolve to no more than three truthful candidates.
5. Pick one and hand logistics to Maps.
6. Return once: Tried, Loved, or Not for us.

## Research implications

- **Three is a product constraint, not a psychological law.** A meta-analysis of 50 experiments found virtually no average choice-overload effect and substantial variation. The candidate limit should therefore be justified by truthfulness, scanability, and decision speed—not a universal claim that more choice is always harmful. [Scheibehenne, Greifeneder & Todd](https://consensus.app/papers/can-there-ever-be-too-many-options-a-metaanalytic-review-of-scheibehenne-greifeneder/2930f189fab95d3495ebbfedb94f142b/)
- **Both people need visible influence.** Shared consumer decisions can increase perceived power and relationship satisfaction because each person has influence and sees the other person engaged. Recommendation reasons should explicitly show mutual agreement or who is introducing whom. [Brick et al.](https://consensus.app/papers/better-to-decide-together-shared-consumer-decision-making-brick-zhou/e56a0fc2d2e258678116b7bf2327a673/)
- **A chosen place must become a concrete plan.** A 642-test meta-analysis found implementation intentions effective across behavioral outcomes, with stronger effects for contingent plans and motivated participants. A later pilot may test an optional “when” after selection, but this should not expand into an itinerary product. [Sheeran, Listrom & Gollwitzer](https://consensus.app/papers/the-when-and-how-of-planning-metaanalysis-of-the-scope-and-sheeran-listrom/5f9f7367e3d95edca818b636686bbd2d/)

## Competitive boundary

- [Beli](https://apps.apple.com/us/app/beli/id1478375386) owns personal restaurant ranking, lists/maps, friend activity, and taste matching. this.is should use simpler signals and avoid becoming another dining feed.
- [Partiful](https://partiful.com/) owns invitations, guest coordination, updates, and reminders. this.is should stop before event administration.
- [Apple Invites](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/) owns the polished shared event object after a decision, with Maps, albums, and playlists. A Pick should remain smaller and place-first.
- [Dorsia](https://www.dorsia.com/faq) demonstrates the value of commitment and a tightly curated inventory, but its exclusivity and reservation economics are not this.is's product.

The unoccupied territory is **private overlap before an outing, followed by a tiny shared memory after it.**

## UX laws

1. People before places. Together opens with a person, never a global feed.
2. Reasons before rankings. Every candidate explains the pair evidence that earned it.
3. Resolution before browsing. The group view leads toward candidates; optional area and practical-need controls stay behind one compact disclosure, while applied values remain visible in its summary.
4. One outcome system. An active Pick first uses We went / Not for us; durable Not for us confirms its group-wide, irreversible consequence with the safe action focused first. After We went, the current attendee gets one Keep as Tried / Keep as Loved control. Do not show the generic save control beside it or turn one person’s outcome into group consensus.
5. No fake consensus. Never infer agreement from popularity, proximity, or AI confidence.
6. No social performance. No likes, follower counts, public review pressure, or influence scores.
7. Maps is the logistics boundary. this.is selects; Maps routes.
8. A real result is more important than a full screen. Honest emptiness is acceptable.

## Visual direction

Keep the current **night salon / shared aperture** system:

- oxblood-black canvas, madder action color, warm-white type;
- Fraunces for human, editorial emphasis; Inter for utility; JetBrains Mono for evidence labels;
- two overlapping traces as the relationship mark;
- compact editorial posters when a permitted place photo is unavailable;
- photos treated as memory fragments, not an infinite content feed;
- no generic glass dashboard, pastel social template, or Yelp-like density.

The old heart-in-a-map-pin mark is legible but generic and overcommits the brand to “places I love.” The current overlapping-circles mark is more ownable and directly encodes the pair thesis.

### Deterministic place posters

Photo-less places no longer collapse into near-identical gradients. `PinVisual` now derives one of
five restrained geometric grammars from the place name: convergence, ledger, aperture,
constellation, or orbit. Each uses the place's stored dominant color, grain, directional light,
and a quiet monogram. The result is stable, local, and free to render; it does not invent visual
evidence or add a Places API request. A permitted real photo still replaces the poster completely.

This procedural system was chosen over generated imagery because it scales to every place without
asset management, misrepresentation, or another external dependency. The July 11 browser pass
also changed the hash after two prototype candidates collided on one motif, preserving the five
grammars while distributing the real recommendation set distinctly.

## Browser audit and changes

The July 11 mobile audit at 390×844 found the strongest visual system in the project so far, but weak information hierarchy. The implemented refinement:

- keeps the three recommended places primary and moves repeated pair evidence behind an explicit disclosure;
- shows all four plan contexts without horizontal clipping;
- hides the general Want / Tried / Loved control while an active Pick is asking for its outcome;
- removes the global dock from focused pair-overlap, planning, and active-Pick views, which already provide a Back action;
- uses a compact poster ratio instead of a large empty hero when no permitted photo exists.

A second first-use audit removed the last visible residue of the retired “rooms / wall” metaphor. Keep now counts places and exposes its own Add a place action; Find a place names its Google Maps capture lane explicitly; People explains the privacy boundary of a connection; onboarding consistently uses “your people.”

Reference captures:

- [`canonical-overlap-refined.png`](../../output/playwright/canonical-overlap-refined.png)
- [`canonical-plan-refined.png`](../../output/playwright/canonical-plan-refined.png)
- [`canonical-pick-refined.png`](../../output/playwright/canonical-pick-refined.png)
- [`support-keep-refined.png`](../../output/playwright/support-keep-refined.png)
- [`support-people-refined.png`](../../output/playwright/support-people-refined.png)
- [`support-capture-refined.png`](../../output/playwright/support-capture-refined.png)
- [`support-onboarding-refined.png`](../../output/playwright/support-onboarding-refined.png)
- [`poster-keep.png`](../../output/playwright/poster-keep.png)
- [`poster-overlap.png`](../../output/playwright/poster-overlap.png)
- [`poster-plan.png`](../../output/playwright/poster-plan.png)
- [`poster-place.png`](../../output/playwright/poster-place.png)
- [`poster-place-reduced-motion.png`](../../output/playwright/poster-place-reduced-motion.png)

The poster pass was rechecked at 390x844 through Keep -> Together -> overlap -> plan -> active
Pick -> place. With reduced-motion media emulation enabled, the rendered place view reported zero
running animations and retained the full state and action hierarchy.

A subsequent daylight/responsiveness pass covered 320x568 and 768x1024. Keep, overlap, plan, and
place retained their hierarchy with no horizontal overflow. The short-phone plan render exposed
the global dock colliding with the selected-place resolution panel; Plan is now a focused route,
the dock is absent, and the resolution panel anchors to the safe-area bottom. A route-policy unit
test protects the focused-flow boundary. Reduced-motion verification on the selected plan again
reported zero running animations.

- [`day-320-keep.png`](../../output/playwright/day-320-keep.png)
- [`day-320-overlap.png`](../../output/playwright/day-320-overlap.png)
- [`day-320-plan-selected.png`](../../output/playwright/day-320-plan-selected.png)
- [`day-320-place.png`](../../output/playwright/day-320-place.png)
- [`day-768-place.png`](../../output/playwright/day-768-place.png)
- [`night-390-plan-selected-focused.png`](../../output/playwright/night-390-plan-selected-focused.png)

The accessibility-language pass then checked the real browser accessibility tree rather than only
visible screenshots. Connection removal now names the person affected; theme announces current and
next mode; Haptics and Near me expose pressed state; and the empty Keep illustration uses literal
product language instead of speaking the retired wall metaphor. Plan's reversible local
deselection is “Choose another,” reserving “Not for us” for closing a durable shared Pick. The
updated Settings, Search, and Plan snapshots produced zero console errors.

The offline-state pass added one app-wide, screen-reader-announced status instead of letting cached
content silently appear current. It promises saved data only when available, exposes last-online
time rather than a fabricated freshness timestamp, and resumes paused writes and queries on
reconnection. At 320x568 the plan remained usable with zero horizontal overflow through the full
offline -> online transition and no console errors. A later cutover-safety pass added a versioned,
owned-asset-only production worker. Its cold-start proof covers the application shell and an unvisited
Privacy deep link, not signed-in data: navigation remains network-first and the worker never caches
API responses, personal/group documents, Google photos, or public Pick receipts.

- [`offline-320-plan.png`](../../output/playwright/offline-320-plan.png)
- [`cold-offline-shell-narrow.png`](../../output/playwright/cold-offline-shell-narrow.png)

The failure-state audit removed two silent traps. A denied pair read now discloses no relationship
evidence, explains that sharing or the connection changed, and routes to People; it cannot remain a
permanent loading skeleton. An unresolved place ID now offers search/retry without rendering an
ellipsis title or invalid Directions link. Existing save snapshots still render the place, signal,
and note when only Google's optional lookup is unavailable. Both recovery screens passed at 320x568
with no overflow or console errors.

- [`pair-permission-denied-320.png`](../../output/playwright/pair-permission-denied-320.png)
- [`place-unavailable-320.png`](../../output/playwright/place-unavailable-320.png)

The recipient-activation audit moved identity into the consent moment. A random invite now exposes
only a rules-bounded inviter name/avatar snapshot before sign-in—never place history—and still
states single use, seven-day expiry, pair-only comparison, and either person's right to disconnect.
Transient lookup failure is no longer mislabeled as an expired invite. Onboarding now waits for
identity/setup writes, reports search/save failure in place, and cannot silently navigate onward
after a rejected completion. The two invite states passed at 320x568 with no overflow or console
errors.

- [`invite-guest-identity-320.png`](../../output/playwright/invite-guest-identity-320.png)
- [`invite-network-recovery-320.png`](../../output/playwright/invite-network-recovery-320.png)

## Approved group-native visual baseline

The approved direction is no longer the earlier oxblood-only pair room. The group study combines:

- a serious deep smoked canvas with restrained post-rain atmosphere;
- parchment/tobacco reading planes rather than large white surfaces;
- localized dark amber/oxblood refraction inspired by architectural resin and warped reflected light;
- coral action used sparingly;
- group avatars and sober registration contours without sparkles, stars, fantasy glow, or dating cues;
- two radii, crisp hairlines, and mostly architectural card geometry.

The July 12 read of Mika's 28-pin public [`Web designs` board](./PINTEREST_VISUAL_READ.md) sharpens
this baseline into **warm atmospheric utility**: immersive photographic or material depth around a
precise, sober interface. Glass must reveal meaningful atmosphere; amber is localized material,
not glowing trim; fantasy pins contribute depth and framing, not magical ornament. That read is the
visual acceptance checklist for the next persistent group-flow pass.

[`group-amber-baseline.png`](./visuals/group-amber-baseline.png) is the approved generated reference.
It is not shipped UI. The development-only group route reconstructs the material with deterministic
CSS gradients, grain, bounded blur, and accessible reading surfaces. See
[`GROUP_DIRECTION.md`](./GROUP_DIRECTION.md) for product, recommendation, privacy, and rollout rules.

Real browser captures:

- [`group-index-amber-390.png`](../../output/playwright/group-index-amber-390.png)
- [`group-recommendations-amber-390.png`](../../output/playwright/group-recommendations-amber-390.png)
- [`group-selected-amber-320.png`](../../output/playwright/group-selected-amber-320.png)
- [`group-coffee-amber-768.png`](../../output/playwright/group-coffee-amber-768.png)

## Figma handoff

- New canonical file: [this.is — Canonical Pair Flow](https://www.figma.com/design/LjCJBUIRRI9ZPtvc4atlD2)
- Historical FigJam found in the 2025 UI audit: [This Is](https://www.figma.com/board/8OR6hbCpU9IVaovQa6twAE/This-Is?node-id=0-1)

The new file was created successfully, but the Starter-plan MCP call limit blocked capture and editing immediately afterward. It is intentionally recorded as an empty handoff target, not represented as a completed design artifact. When the limit resets or the plan changes, import these exact prototype routes:

1. `/together?prototype=pair`
2. `/with/prototype-vivian?prototype=pair`
3. `/with/prototype-vivian/plan?prototype=pair`
4. `/p/proto-radio-bakery?pick=prototype-pick-proto-radio-bakery&prototype=pair`

Build the four frames from the code tokens and componentize Person Row, Candidate Row, Pair Poster, Context Pill, Pick Return, and Dock. Do not use the Figma file to invent features outside the validated loop.

## Next proof

The remaining design work is not another moodboard. It is the eight-pair pilot in `VALIDATION_PLAN.md` (with an optional diagnostic read after five) that tests whether people:

- understand why a candidate appeared;
- perceive both people as having influence;
- can select a place without teaching;
- trust what is shared and what stays private;
- return after the outing to close the Pick.
