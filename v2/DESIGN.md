# this.is v2 visual language

This file is the implementation-facing design contract for the canonical pair-first app in `v2/`.
The full product rationale and research record live in `../docs/product-reset/DESIGN_DIRECTION.md`.

## Thesis

> Find the place your people already agree on.

The interface should feel like a private collection of remembered places becoming useful at the
moment two people decide. It is editorial, intimate, and selective. It is not a public restaurant
feed, review database, event planner, or generic AI dashboard.

## Source of truth

`src/styles/tokens.css` owns exact color, type, radius, duration, and easing values. Do not copy
token values into components. The canonical visual territory is:

- oxblood-black canvas, quiet rose surfaces, madder action color, warm-white text;
- Fraunces for names and human emphasis, Inter for utility, JetBrains Mono for evidence and facts;
- two overlapping traces as the relationship mark;
- one restrained glass recipe for navigation and temporary chrome, never for every card;
- earned color: madder identifies the next meaningful action, not idle decoration.

## Place imagery

Real, permitted photography always wins. Use `PinVisual`; do not add raw Places `<img>` elements
or introduce new photo requests. The same light photo grade applies everywhere. Attribution stays
visible where required.

When a photo is unavailable, the place becomes a deterministic editorial poster rather than a
generic gradient or fake photograph. `PinVisual` hashes the place name into one of five quiet
geometric grammars:

1. convergence - paired rings;
2. ledger - ruled lines and an arch;
3. aperture - a rotated frame and circle;
4. constellation - points joined by traces;
5. orbit - a cropped ellipse and capsule.

All variants share the stored dominant color, soft directional light, grain, and a low-contrast
monogram. The grammar must remain subordinate to the place name and evidence. It must be stable
across devices, cost nothing to render, and disappear completely once a real photo loads.

## Information hierarchy

- **Together:** a person is the entry point. No global discovery feed.
- **Pair overlap:** at most three places, each with a truthful reason. Repeated evidence is
  available on demand, not repeated above the decision.
- **Plan:** context is a small refinement; candidates and their reasons remain the center.
- **Active Pick:** the chosen place and Tried / Loved / Not for us are the only outcome system.
- **Keep:** a personal place memory using Want / Tried / Loved, not a public collection wall.
- **People:** connection and privacy state, not follower metrics.
- **Place:** a memory fragment, pair evidence, Maps handoff, visibility, and a short note.

## State and motion

Want and Tried are quiet. Loved may carry the strongest earned treatment. An active Pick takes
precedence over the general save state. Never use popularity, proximity, or model confidence to
imitate social proof.

Motion clarifies entry, selection, and confirmation only. All nonessential animation is scoped to
`prefers-reduced-motion: no-preference`; reduced motion must remain complete and readable with no
motion-dependent state. Haptics follow the same preference.

## Voice

Human copy is short, warm, and specific. A friend's note should read like a text, not a review.
Evidence says exactly why a place appeared: "You both want this," "Vivian loved this," or "Your
turn to introduce Vivian." Utility labels are literal: Together, Keep, People, Add a place,
Directions. Avoid exclamation marks, rankings, stars, influence language, "rooms," "wall," and
decorative gallery metaphors in product copy.

## Review bans

- no public feed, likes, follower counts, reviews, or leaderboard furniture;
- no fake consensus or unexplained recommendation scores;
- no generic glass dashboard, pastel social template, Yelp-like density, or Material-dark clone;
- no candle, ember, flame, honey, parchment, or heart-in-a-map-pin brand motifs;
- no generated food photography posing as evidence;
- no new navigation noun or state system without updating the product reset record first.

## Current visual proof

The canonical 390x844 captures are in `../output/playwright/`:

- `poster-keep.png`
- `poster-overlap.png`
- `poster-plan.png`
- `poster-place.png`
- `poster-place-reduced-motion.png`
- `day-320-keep.png`
- `day-320-overlap.png`
- `day-320-plan-selected.png`
- `day-320-place.png`
- `day-768-place.png`
- `night-390-plan-selected-focused.png`
