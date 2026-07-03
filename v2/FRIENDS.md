# FRIENDS.md — this.is: discovery of friends' tastes (adopted 2026-07-02)

> **This is the CURRENT product direction. It supersedes the editorial-curator framing in
> `DIRECTION.md`** (which stays as useful competitive/architecture research). The owner's own
> words are the spine: *"the core of this.is is discovery of friend's tastes."* Arrived at with
> the owner + an external (Gemini) counsel session; this doc is the canonical record.

## The one line

**"Multiplayer notes for places."** The digital group-chat answer to *"where should we go
tonight?"* — a low-lit, invite-only map of where the people you trust actually go. Not a review
site, not a social network, not a search engine. You discover a bar because *Vivian loved it and
left a note*, not because 2,000 strangers rated it 4.3.

## Why this (and why it beats the two dead ends)

- The **Yelp/Google competitor** needs millions of users + moderation + funding — a solo builder
  loses on volume.
- The **founder-curated editorial magazine** needs endless owner labor and doesn't compound.
- The **friend graph** solves both: you don't need a million users, just tight circles; and your
  users curate for each other. It's the one model where a solo builder's constraints are a fit.

## The rating system (the whole thing)

**Want · Tried · Loved.** No stars, no long reviews, one optional note. `loved` is the strong
signal (madder-red), `tried` neutral, `want` faint.

## The three surfaces

1. **Friend Feed (Home)** — the timeline of your circle's nights out. Full-width cards: the room's
   photo, *who tagged it and how*, and their note below. (`pages/Home.tsx`, `FriendFeedCard`.)
2. **The Spot Page = a shared memory** (`pages/Closeup.tsx` + `FriendGraph`) — the emotional core.
   Below the room's hero + vitals, **FROM YOUR PEOPLE**: each friend's avatar, their Want/Tried/
   Loved, and their 1 AM-text note. This is the most-rewarding moment — uncovering a piece of a
   friend's life, not reading a critique. Then one door out: Open in Google Maps.
3. **Your Wall (Profile)** — a flat masonry of everywhere *you* Want/Tried/Loved. *(Still shows the
   legacy want/been pins — migrating to Want/Tried/Loved is the next core task, see below.)*

## The two-layer architecture (the cold-start net — never blended)

- **Layer 1 — the Friend Graph (premium):** `saves` where uid ∈ your circle. May be empty on day
  one; that's fine *if Layer 2 catches you*.
- **Layer 2 — Nearby & Unexplored (scaffold):** the geo-cell Google sweep, rendered as the
  `NEARBY & UNEXPLORED` masonry. Honestly labeled, never given a friend's voice. A solo user with
  zero friends still lands on a full, beautiful Layer 2 and can tap Want/Tried/Loved to pull a room
  onto their Wall — the **single-player utility floor** that must be flawless.

## The Google ruling (unchanged — `docs/GOOGLE.md`)

Google is the **logistics backend, not the UI**: `g:{place_id}`, coordinates, hours, autocomplete
for adding a place, and the **Open-in-Google-Maps handoff**. **You own the pixels** — hero imagery
is user/owned photos → plate-art + hex fallback; live Google photos only closeup, budget-gated,
attributed, never cached, never the grid hero. No in-app map.

## Data model (flat, read-optimized — Firestore)

- `users/{uid}` — `{ handle, displayName, avatarHex, following: [uid] }`.
- `saves/{saveId}` — the connective tissue: `{ uid, placeId: g:{pid}, tag: want|tried|loved,
  note?, ts }`. Flat top-level so the feed is one query: `where('uid','in', following),
  orderBy('ts','desc')`.
- `places/{g:pid}` / `curated/*` / `cities/{cell}/candidates/*` — immutable room facts + scaffold.
- Rules: `saves` public-read for the intimate-circle demo, owner-write; tighten reads to the
  follow-graph at real launch.

## Go-to-market (beat the empty room)

**Do not launch public.** (1) Group-chat beta: force one 4–6-person friend group to use it a month,
seed 20–30 places yourself. (2) Single-player floor: the fastest, prettiest way to save a place you
saw on TikTok/IG, non-empty via Layer 2. (3) Invite-only expansion: invite links auto-connect
users as friends — the magic first-open is seeing where your friends go.

## Design (Salon Madder + the tactile reveal — later polish)

Keep `DESIGN.md`'s oxblood `#140D10` / madder `#C13B4C` / Fraunces + JetBrains-Mono. Planned
tactile layer (not yet built): the "Vitrine" smoked-glass sheets/toasts; the **card-pull** reveal
into the spot page; the **picture-light sweep** on Loved (warm radial across the top edge, no
confetti) + a heavy haptic; ghost-avatar overlaps; borderless "Wall" grids that glow where two
friends both Loved a place.

## Built vs. next

**Built:** `saves` collection + rules (deployed); demo friend graph (`scripts/seed-social.mjs` —
Vivian/Uri/Sam, 13 Want/Tried/Loved notes with denormalized place snapshots); `data/social.ts` +
`usePlaceSaves`/`useFriendFeed`/`useMySaves`; the Spot-Page friend graph (`FriendGraph`, `Avatar`);
the two-layer Home (`FriendFeedCard` + Nearby & Unexplored); shared `usePlacePhoto`. **✅ THE OWN
SAVE FLOW is real:** `data/saves.ts` (`setSave`/`clearSave`/`setSaveNote`) + the rewired
`useSaveFlow` write Want/Tried/Loved to the flat `saves` collection (so your saves enter the friend
graph); the spot page has a Want/Tried/Loved control + per-save note + a picture-light on Loved; the
**Wall** (`pages/Saved.tsx`) reads your own saves filtered by tag; Add/Onboarding/Search rewired;
the legacy pins/boards system (pins.ts, boards.ts, PinCard) is DELETED. Verified end-to-end with an
anonymous session (save Loved → picture-light → lands on the Wall; test data auto-cleaned).

**Next core tasks (in order):**
1. **Real people:** handles + avatar at sign-up, an invite link that auto-follows, the `following`
   array wired into the feed query (`fetchFriendFeed` currently shows all-but-self for the demo).
2. **The tactile reveal** (card-pull into the spot page + a picture-light *sweep* animation + a
   heavy haptic) for the Loved moment.
3. **User photos** attached to a save/place (the "snap it when you save it" that owns the pixels).
4. Auto-seed the scaffold on first open in an un-seeded cell (Cloud Function; see `docs/GOOGLE.md`).

Related: `DIRECTION.md` (prior editorial direction + competitive research), `DESIGN.md`,
`docs/GOOGLE.md`, `BRIEF.md`.
