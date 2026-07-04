# PRIVATE VIEW — the this.is v2 visual language

> **The visual language for the CURRENT friend-graph direction (`FRIENDS.md` — "discovery of
> friends' tastes").** The palette, laws, grade, type, radii, and motion below stand **unchanged**
> from the panel synthesis; only the **Motifs, Voice, and Copy deck** are re-cut for the friend
> graph. The save vocabulary is now **Want · Tried · Loved** — Loved is the earned "picture-light"
> celebration (it maps to the panel's old **Been**; where the Palette and Laws below still say
> "Been," read "Loved"), while Want and Tried stay quiet. The deleted save-app furniture — boards,
> the TONIGHT rail, the morning-after card, the Rehang — is gone; the product IA is the **Friend
> Feed** (Home), the **spot page** (a shared memory), and the **Wall** (Saved).

*Synthesized July 2026 from a 4-designer / 3-judge panel (designs: PRIVATE VIEW, LATE EDITION,
SHELFMARK, CIVIL TWILIGHT; judges: daily-driver, shipwright, brand-soul). The three judges split
three ways (144/142/140 totals); the synthesis takes the brand-soul winner as chassis and grafts
the properties the other two winners won on.*

**Replaces the EMBERBOARD/Candlewax direction in ../MAKEOVER.md, which the owner rejected.**
Banned everywhere: candle/ember/match/flame motifs; walnut-brown/honey-amber as identity hues;
parchment/cream/sage; pastel-cute, clinical white, corporate gray; Material #121212 neutral dark.

## The one-liner

> Your saved places hang like pictures in a dark salon-red room, and the app is the lighting
> rig: a wanted place waits in ambient dark, a visited place gets its picture-light switched on
> — **acting on a save is literally how you light your walls.**

The register line: **"Everything you save is waiting for its light."**

## The room (hue territory)

SALON MADDER — the deep oxblood of a 19th-century salon gallery wall after closing, with one
rose-madder accent and warm-white picture-light. Red-family throughout: categorically not the
banned walnut/honey ember palette (no orange, no yellow), not Corner pastel, not Beli white, not
Google gray-blue, not neutral dev-tool dark. The daylight theme is the same room with the house
lights up: rose-cast gallery plaster, never parchment (zero yellow in the mix).

## Laws (enforced at review)

1. **The print never changes; only the light moves.** ONE photo grade, identical in both themes,
   applied to every image (Google/user/AI). All product states are *lighting layered on top* —
   glows, veils, mats — never per-state filters.
2. **Anti-murk doctrine** (grafted from CIVIL TWILIGHT): atmosphere lives around the photo,
   never in it. The grade must not reduce brightness or visibly desaturate. Grade:
   `contrast(1.05) saturate(1.02) sepia(0.05) hue-rotate(-6deg)` — a breath of rose, no dimming.
3. **Earned color** (grafted from LATE EDITION): the celebration light (`--celebrate`) appears
   ONLY on Been artifacts. Chrome has a color budget of ~zero; the madder accent is reserved for
   primary actions. Nothing glows idle.
4. **Once hung, always lit** (unanimous graft): Been pins are permanently exempt from the 90-day
   recede.
5. **The recede is static** (2 judges): a fixed veil + desaturation class at 90 days untouched.
   No cross-session animation state machines.
6. **Placeholders sit inside the room** (grafted from SHELFMARK):
   `color-mix(in oklab, var(--dominant) 85%, var(--canvas))` — dominant-hex blocks are pulled
   15% toward the wall so the loading grid is already art-directed. Never a spinner, never white.
7. Photo captions/scrim text use the static `--on-photo-*` tokens (they sit on photographs and
   must not flip with the theme).

## Palette (tokens.css is the source of truth)

| Token | Night | Day | Role |
|---|---|---|---|
| `--canvas` | `#140D10` | `#EDE4E6` | oxblood salon wall / rose-cast plaster |
| `--card` | `#1E1418` | `#F6F1F2` | card & module surface |
| `--sheet` | `#251A1F` | `#FBF8F9` | sheets, picker, elevated chrome fill |
| `--text-1/2/3` | `#F2ECEB / #BCACB0 / #8E7E83` | `#221820 / #554449 / #7A676D` | ramp (AA verified: 2 ≥ 8:1, 3 ≥ 4.6:1) |
| `--action` | `#C13B4C` (press `#A62C3E`) | `#A62C3E` (press `#8E2434`) | madder — GO, save, primary pills |
| `--celebrate` | `#FBEFE9` | `#8F2436` | the picture-light; Been only |
| `--status-open/closing/closed` | `#4CA678 / #C9694F / #8A7A7E` | `#2E7D57 / #A65238 / #7A676D` | vitals only, never identity |

Type: Fraunces 600 (names & feelings) · Inter (body) · JetBrains Mono 11px caps (the engraved
plaque: facts only — distances, dates, counts). 7 size tokens. Radii: 20px frames, 999px pills.
Motion: 120/220/320ms + the ported eases, press-scale(0.97). Glass: ONE recipe, "the vitrine"
(smoked museum glass), chrome only — dock, toast, sheet. Never on pins.

## Motifs

- **THE HANG (Loved)**: Loved is the earned status — the picture-light comes on. A warm radial
  pinned to the card's top edge, a 1px celebrate hairline ring, and a solid picture-light
  **plaque** chip (`LOVED · 12 MAY`, dark text on light — must read at masonry squint distance; a
  Wall with several Loved cards visibly glows warmer). Daylight inverts glow to gravity: a soft
  shadow + 1px madder mat line. (Loved is the panel's old "Been"; the Laws' Been-exemptions are
  Loved-exemptions.)
- **THE QUIET SAVE (Want · Tried)**: the two lower signals never light up. `want` is a faint chip
  — the title sits toward `--text-3`, no glow, "waiting in ambient dark"; `tried` is a neutral
  mono chip. Only Loved earns color — Law 3 in the vocabulary of the friend graph.
- **THE FRIEND FEED CARD** (`FriendFeedCard`, Home): full-width — the room's graded photo, an
  avatar + a `WHO · HOW` line (e.g. *Vivian — LOVED*), and the friend's one-line note below in
  serif. It is the timeline unit of your circle's nights out. Nearby & Unexplored cards reuse the
  frame but are honestly labeled and given no friend's voice — never a fake avatar.
- **FROM YOUR PEOPLE** (the spot page, `pages/Closeup.tsx` + `FriendGraph`): below the room's
  hero + vitals, the emotional core — each friend's `Avatar`, their Want/Tried/Loved, and their
  1 AM-text note. Loved rows carry the plaque; Want/Tried sit quiet. The most-rewarding moment is
  uncovering a piece of a friend's life, not reading a critique. One door out: **Open in Google
  Maps.**
- **THE WALL (Saved)** (`pages/Saved.tsx`): a flat, borderless masonry of everywhere *you*
  Want/Tried/Loved, filtered by tag. Loved tiles carry their light, so the wall glows warmer the
  more you've Loved. The empty state is the bare wall: one picture-light over a lone steel hook.
- **THE ACQUISITION (the save moment)**: press-scale → on **Loved**, a 40%-wide picture-light
  band sweeps the card (`.save-sweep`) → the vitrine toast rises. Want/Tried resolve quietly on
  the toast alone. No confetti — acquiring a work is a quiet, certain pleasure.
- **INTO STORAGE (90-day recede)**: an untouched **Want** loses its light — canvas-colored veil +
  slight desaturation; title drops a ramp step (Laws 4–5). **Loved is permanently exempt** — once
  hung, always lit. Never deleted, never nagging.
- **THE TACTILE REVEAL (planned — `FRIENDS.md`, not yet built)**: the forward-looking layer the
  direction still endorses. The **card-pull** that draws a feed card open into the spot page; the
  picture-light **sweep** + a **heavy haptic** at the instant a place becomes Loved; **ghost-avatar
  overlaps** where several friends stack on one room; and Wall grids that **glow where two friends
  both Loved** the same place. Ships as polish once the friend graph is real.

## Voice

Two registers, one room. The **serif** layer speaks only names and feelings — place names and
your friends' notes, which read like a 1 AM text, not a review: declarative, warm, short; zero
exclamation marks, zero stars. The **mono** layer speaks only facts — distances, dates, tags,
hours, counts — engraved on the plaque. There is no "boards" IA: the three surfaces are the
**Friend Feed** (Home), the **spot page** as a shared memory, and your **Wall** (Saved).
"Walls / hang / light" stays register for serif chrome only; a friend's own words are never
dressed up — they run verbatim.

Copy deck: save control **Want · Tried · Loved** · note prompt "Leave a note for whoever comes
next." · spot-page header **FROM YOUR PEOPLE** · a friend's Loved plaque `LOVED · 12 MAY` · empty
Wall "The lights are on. The walls are bare." / "Save one place today. Your wall starts with
one." · empty Friend Feed "No one's been out yet." (with the honest **Nearby & Unexplored** grid
below) · error "The lights flickered." · the one door out **Open in Google Maps**.

## Asset kit (W4, ~30 assets, style-locked)

Prefix: *"Quiet still-life photograph in near-darkness. Subject lit by a single warm
picture-light from upper left; everything else falls into deep oxblood-black (#140D10). Matte
varnished finish, faint silver-gelatin grain, muted colors with at most one rose-madder accent
(#C13B4C). Composed like a small painting: centered subject, generous negative space, portrait
4:5."* Negative: *"no text, no logos, no watermarks, no human faces, no candles, no flames, no
fire, no gold, no brass, no purple, no gradients, no neon, no pastel."*
12 vibe tiles · 14 category plates · 4 empty scenes (empty-Wall = the bare wall: one picture
light over a lone steel hook).

## Provenance

Panel scores (identity/distinctiveness/photo-first/buildability/day-night/cliché): PRIVATE VIEW
140, LATE EDITION 144, SHELFMARK 142, CIVIL TWILIGHT 132 — each judge crowned a different
winner; brand-soul's verdict ("the only language that answers the soul-brief without paying for
warmth in banned currency") decided the chassis, with the daily-driver's ergonomic objections
(murk, Been squint-legibility) and the shipwright's build objections (veil state machine,
unverified contrast) resolved by the grafts above. Full transcripts in the session workflow
directory.
