# this.is v2

**Discovery of friends' tastes** — multiplayer notes for places. A low-lit,
invite-only map of where the people you trust actually go. You find a bar
because *Vivian loved it and left a note*, not because 2,000 strangers rated it
4.3. Not a review site, not a social network, not a search engine.

The whole rating system is three words plus one optional note: **Want · Tried ·
Loved.** No stars, no reviews. `loved` is the strong signal, `tried` neutral,
`want` faint.

> Current direction: [`FRIENDS.md`](FRIENDS.md) (adopted 2026-07-02) is the source
> of truth. Governance and the NEVER list: [`CLAUDE.md`](CLAUDE.md). Visual language
> ("Salon Madder"): [`DESIGN.md`](DESIGN.md). Cost/ToS ruling on Google:
> [`docs/GOOGLE.md`](docs/GOOGLE.md).

## The three surfaces

1. **Friend Feed (Home)** — `pages/Home.tsx`. Your circle's nights out: the
   room's photo, who tagged it and how, and their note. Layers never blend —
   `YOUR PEOPLE HERE` (friends' Loved rooms a short walk away right now),
   `FROM YOUR PEOPLE` (the rest of the feed), then the discovery scaffold.
2. **The spot page = a shared memory** — `pages/Closeup.tsx` + `FriendGraph`.
   The room's hero and vitals, then **FROM YOUR PEOPLE**: each friend's avatar,
   their Want/Tried/Loved, and their 1 AM-text note. Your own Want/Tried/Loved
   control, an optional note, and one door out: Open in Google Maps.
3. **Your Wall (Saved)** — `pages/Saved.tsx`. A flat masonry of everywhere *you*
   Want/Tried/Loved, filtered by tag. No boards — the tag is the whole structure.

## People: invite = mutual follow

Your circle is the `following` array on `users/{uid}`. An invite link
`/i/:uid` (`pages/Invite.tsx`) makes you and the opener **follow each other**,
so their rooms land in your feed and yours in theirs. Copy your own link in
**Settings**. New users auto-follow three demo tastemakers (`demo-vivian`,
`demo-uri`, `demo-sam`) so the feed is never empty on day one — all removable in
Settings.

## The two-layer cold-start net (never blended)

- **Layer 1 — the friend graph.** `saves` where the author is someone you
  follow. May be empty on day one; that's fine if Layer 2 catches you.
- **Layer 2 — the scaffold.** The geo-cell Google sweep rendered as
  `NEARBY & UNEXPLORED`, plus the curated city guide as `ON THE LOW-LIT LIST`.
  Honestly labeled by proximity — only rooms with a real walk time appear under
  "nearby"; a far-away curated scene is never mislabeled. A user with zero
  friends still lands on a full, beautiful grid and can tap Want/Tried/Loved to
  pull a room onto their Wall.

## Data model (flat, read-optimized — Firestore)

- `saves/{uid}__g:{pid}` — the connective tissue. One doc per person+place
  (idempotent), `{ uid, placeId, tag, note?, ts, place }` with a **denormalized
  place snapshot** so the feed, the spot-page graph, and your Wall each render
  from a single query with zero joins. One write path: `data/saves.ts`
  (`setSave` / `clearSave` / `setSaveNote`); reads in `data/social.ts`
  (`fetchPlaceSaves` / `fetchFriendFeed` / `fetchMySaves`).
- `users/{uid}` — `{ handle, displayName, avatarHex, following: [uid], tasteSeed }`
  (`data/user.ts`).
- `places/{g:pid}` · `curated/*` · `cities/{cell}/candidates/*` — immutable room
  facts and the Layer-2 scaffold (`data/candidates.ts`, `data/types.ts`).
- **Identity law:** every place is `g:{google_place_id}`, everywhere — place
  docs, save IDs, routes. No second namespace.

Query hooks (TanStack Query over Firestore's persistent cache — the only two
caching layers) live in `data/queries.ts`; taste vector in `data/taste.ts`.

## The Google ruling (logistics backend, not the UI)

Google supplies `g:{place_id}`, coordinates, hours, autocomplete for adding a
place, and the **Open-in-Google-Maps handoff**. There is **no in-app map**.
**You own the pixels:** hero imagery is user/owned photos → a plate + hex-block
fallback; live Google photos appear only on a closeup, budget-gated and
attributed, never on the grid. Full ruling: [`docs/GOOGLE.md`](docs/GOOGLE.md).

## Run it

```bash
npm install
npm run dev         # Vite dev server (env from the repo-root .env.local)
npm run build       # typecheck (tsc) + production build
npm run typecheck   # tsc only
```

New-repo posture: `v2/` imports nothing from the v1 tree and can be lifted out
by copying the folder. Same Firebase project (`this-is-76332`) until cutover.

## Seed & import scripts

```bash
node scripts/seed-curated.mjs      # curated low-lit rooms → curated/{g:pid}
node scripts/seed-candidates.mjs   # geo-cell Layer-2 scaffold → cities/{cell}/candidates
node scripts/seed-social.mjs       # demo friend graph (Vivian/Uri/Sam + their notes)
node scripts/import-owner-saves.mjs --uid <you> --file places.txt   # your real Google Maps saves → flat `saves`
```

`import-owner-saves.mjs` (also `npm run import:owner`) recreates your real
Google Maps saves as flat top-level `saves`, applying one Want/Tried/Loved tag
per run — the go-to-market "seed 20–30 places yourself" step.

## Governing docs

- [`FRIENDS.md`](FRIENDS.md) — the product direction (source of truth).
- [`DESIGN.md`](DESIGN.md) — the Salon Madder visual language.
- [`docs/GOOGLE.md`](docs/GOOGLE.md) — the cost/ToS ruling on Google Places.
- [`CLAUDE.md`](CLAUDE.md) — governance, hard laws, and the NEVER list.
