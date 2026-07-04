# CLAUDE.md — this.is v2

> **⚠️ CURRENT DIRECTION: `FRIENDS.md` (adopted 2026-07-02) — "discovery of friends' tastes."**
> this.is is now a **friend-graph** app: Want/Tried/Loved + notes, a friend feed, and the spot
> page as a *shared memory* ("Vivian loved this — 'get the orange wine'"), over a two-layer
> cold-start net (friend graph + auto-seeded "Nearby & Unexplored" scaffold). Read `FRIENDS.md`
> first. It supersedes the editorial-curator framing in `DIRECTION.md` (kept for its competitive
> research + architecture). Still-dead: TONIGHT rail, morning-after, boards, trip mode,
> leaderboards/influence/DMs/public-feeds. The visual language (`DESIGN.md`), the Google ruling
> (`docs/GOOGLE.md`), and the engine still stand.

Governance for the v2 rebuild. Written before week 1, per MAKEOVER.md (repo root, one level
up). **One design note overrides that document: the owner rejected the EMBERBOARD/Candlewax
candlelit-ember styling.** v2's visual language is its own (see `DESIGN.md` here); the ember /
match / candle motif family, walnut/honey palette, and parchment lights are all banned.

## The NEVER list (dead, not deferred — enforced at review)

Posts · comments · DMs · activity feeds · hubs · public profiles · influence scores ·
leaderboards · streaks · a map page · boards/folders · trip planning · a "where tonight"
decision engine · reservations/ticketing. Mid-pass feature creep is the single biggest
schedule threat; do not implement these even as stubs.

## Hard laws

- **New-repo posture**: `v2/` imports nothing from the v1 tree. Ported code is copied, not
  imported. (It lives inside this repo for reviewability; it must stay extractable by copying
  the folder.)
- **One save path**: every Want/Tried/Loved goes through `src/data/saves.ts`
  (`setSave` / `clearSave` / `setSaveNote`). No surface writes `saves`/`places` docs directly.
- **Identity**: every place is `g:{google_place_id}` — place docs, save doc IDs
  (`{uid}__g:{pid}`), routes. No second namespace, ever.
- **No confirm dialogs anywhere; undo toasts only.**
- **Every surface is a route** (sheets via search params). Hardware back must always work.
  Zero modal-manager state, zero `window.CustomEvent` buses.
- **Caching** = Firestore `persistentLocalCache` + TanStack Query. No ad-hoc localStorage
  document mirrors (localStorage is allowed for tiny preferences: theme, haptics, coords).
- **Cost discipline** (the full ruling: `docs/GOOGLE.md`): autocomplete only inside session
  tokens; `getDetails` only on explicit user action; photo resource names never cached; photos
  always attributed; browsing never writes Firestore. **The mask split**: the Pro-tier full
  mask runs only at save time and for unsaved deep-links; saved-pin closeups use the free
  photo-ref mask (`getPhotoRef`) and render from the snapshot, with a 90-day full-mask
  snapshot refresh. **Grid photos are budget-gated and never cached** — the interim posture
  (`docs/GOOGLE.md` decision 10) allows live Google grid photos under a hard per-day media
  budget (`lib/photoBudget.ts`); user/owned photos take over as they accumulate, and the
  fallback is always plate → hex, never a spinner. "Google Maps" text attribution renders near
  Google-sourced content.
- **Honesty**: no placebo UI. A control that doesn't work yet doesn't render. Stale data is
  hidden, not shown ("honest absence beats a placebo"). Own-save resurfacing is labeled, never
  disguised as discovery.
- **Global-first**: no hardcoded city, region, or language anywhere. The app must work in any
  city on earth: Places language follows the device, autocomplete is biased toward (never
  restricted to) the user's cached coords, and the W3 `cities/{cityKey}` candidate pools derive
  cityKey from coords at runtime. The owner's seed city (Piscataway, NJ — import script,
  first candidate pool, dogfood) is a seed, never a default baked into code.

## The cut order (first → last)

If scope must be cut, drop in this order: paste-a-link → generated-asset breadth → the geo-cell
auto-seed Cloud Function (Home falls back to curated + a direct candidates query).
**Never cut**: 1-tap Want/Tried/Loved, the friend feed, the spot-page shared memory
("FROM YOUR PEOPLE"), honest-hours-or-honest-absence.

## Hard ship gates (if any fails, cut scope, not the budget)

Cold first-content <1s on a throttled phone · save = 1 tap · entry chunk <150kB gzip ·
Lighthouse perf >90 · zero confirm dialogs · the zero-Google-photo grid state explicitly
art-directed and screenshot.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # typecheck + production build
npm run typecheck    # tsc only
npm run import:owner # owner-import script (see scripts/)
```

## Firebase

Same project as v1 (`this-is-76332`); env keys come from the repo-root `.env.local` via Vite
`envDir`. v2 data lives in the flat top-level `saves/{uid}__g:{pid}` collection, `users/{uid}`
(with a `following` array), and `g:`-prefixed `places/*` / `curated/*` /
`cities/{cell}/candidates/*` docs, coexisting with v1 until cutover. The DEPLOYED rules are the
repo-root `firestore.rules`; the `firestore.rules` in this folder is a stale default-deny draft
(still models boards/pins, no `saves` block) — update or delete it before any cutover. **Do not
deploy rules casually**: deploying replaces the whole ruleset and v1 is still serving.
