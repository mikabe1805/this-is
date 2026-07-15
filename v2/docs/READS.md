# READS.md — scoping the friend graph (the #1 launch blocker)

> **HISTORICAL - RESOLVED BY THE PAIR RESET.** This proposal describes the retired public-read
> friend graph. Canonical authorization is implemented in [`../firestore.rules`](../firestore.rules),
> tested by [`../tests/firestore-rules.mjs`](../tests/firestore-rules.mjs), and governed by
> [`../../docs/product-reset/UX_ARCHITECTURE.md`](../../docs/product-reset/UX_ARCHITECTURE.md).
> Do not implement the alternative schemas proposed below.

*Design for restricting who can read the friend graph, before a real (non-demo) launch.
Companion to `GOOGLE.md`. Status: **proposed — owner decision required** before implementing.
Roadmap ref: `ROADMAP.md` Next-#2.*

---

## The problem

Today the flat `saves` collection and every `users` doc are **world-readable** (`firestore.rules`:
`allow read: if true`). That is deliberate for the intimate-circle **demo** (FRIENDS.md GTM). But
the data is a location history + a social graph + free-text 1 AM notes, so at a real launch it must
be readable **only by the people in your circle**. This is the load-bearing privacy decision, and
it is *not* a one-line rules change — Firestore rules cannot cheaply scope a **collection query** to
a dynamic follow-graph.

**Why not just tighten the rule.** A read rule like `allow read: if request.auth.uid in
resource.data.followers` can't be enforced on a *query* such as `where('uid','in', circle)`:
Firestore rejects any query it can't *prove* returns only rule-satisfying documents, and that proof
must come from the query's own constraints, not a per-doc lookup. A `get()` per document isn't
possible inside a collection query. So the read model, not just the rule, has to change.

## The three options

| | Model | Read rule | Effort | Verdict |
|---|---|---|---|---|
| **A** | **Auth-only** (interim) | `allow read: if signedIn()` | S | Stop-gap only — blocks anonymous scraping but every *signed-in* user can still read everyone. Not "intimate". |
| **B** | **`readableBy` denormalization** | `request.auth.uid in resource.data.readableBy` | M–L | **Recommended.** Each save carries the set of uids allowed to read it; queries filter by it. Rules stay O(1), no per-doc `get`. |
| **C** | **Fan-out feeds** (per-user copies) | owner-only on `feeds/{uid}/items` | L | Overkill here. Write amplification on every save; only worth it at feed scales this app won't hit. |

## Recommendation: **B — `readableBy`**, with **A** as the pre-launch stop-gap

Ship **A** the day you close the public demo (one-line rule), then build **B** as the real model.

### B.1 Schema

Add one field to every `saves/{uid}__g:pid}` doc:

```
readableBy: string[]   // [ownerUid, ...ownerFollowers]  — who may read this save
```

`users/{uid}` gains nothing new (it already has `following`); reads of `users` tighten to
`signedIn()` (resolving a friend's name/avatar requires being signed in, which is fine).

### B.2 The query changes (client)

Every `saves` read gains an `array-contains` constraint so the query provably matches the rule:

- **Friend feed** — `data/social.ts#fetchFriendFeed`:
  `where('readableBy','array-contains', myUid)` **replaces** `where('uid','in', circle)`.
  This returns exactly the saves you're allowed to see = your circle's + your own, in one query
  (no 30-item `in` cap, no client-side circle filter). Order by `ts` desc → needs a composite index.
- **A place's people** — `data/social.ts#fetchPlaceSaves`:
  `where('placeId','==', id)` **+** `where('readableBy','array-contains', myUid)`.
- **Your Wall** — `data/social.ts#fetchMySaves(myUid)`: unchanged in spirit
  (`where('uid','==', myUid)`) — you're always in your own `readableBy`, but keep the `uid` filter;
  add the `array-contains` only if you tighten the rule to forbid the `uid==self` shortcut.
- **The Overlap** — `pages/Overlap.tsx` reads a friend's saves via `fetchMySaves(friendUid)`; under
  B this becomes `where('uid','==', friendUid) && where('readableBy','array-contains', myUid)`, so
  you only ever see the friend's saves they've shared with you (which, since you follow them, is all
  of them). Add a dedicated `fetchUserSavesVisibleTo(friendUid, myUid)`.

### B.3 The fan-out (Cloud Functions — the cost of B)

`readableBy` must stay correct as the graph changes. Three triggers (`v2/functions`):

1. **onSaveWrite** (`saves/{id}` create) — set `readableBy = [ownerUid, ...followersOf(ownerUid)]`.
   Needs the owner's *followers* — maintain a `users/{uid}.followers` array (mirror of `following`,
   written by the follow function) or query `where('following','array-contains', ownerUid)`.
2. **onFollow** (someone follows you) — `arrayUnion(newFollowerUid)` into `readableBy` of **all your
   saves**. O(yourSaves) writes. Batched (500/batch).
3. **onUnfollow** — `arrayRemove(exFollowerUid)` from all your saves. O(yourSaves).

This is why B is a Cloud Function job, not client code: the fan-out on follow/unfollow is a
privileged, batched, idempotent sweep. It also **retires the client-side `addMutualFollow`
cross-user write** (the residual hole flagged in `firestore.rules` + the review): follows go through
a callable that writes both `following`/`followers` edges and enqueues the fan-out.

### B.4 Rules (the cutover target — already partly drafted in `v2/firestore.rules`)

```
match /saves/{saveId} {
  allow read: if signedIn() && request.auth.uid in resource.data.readableBy;
  allow create, update: if signedIn() && request.resource.data.uid == request.auth.uid;
  allow delete: if signedIn() && resource.data.uid == request.auth.uid;
}
match /users/{uid} {
  allow read: if signedIn();
  allow write: if isOwner(uid);          // follows move to a callable; drop the cross-user append
}
```

### B.5 Indexes

- `saves`: `readableBy array-contains` + `ts desc` (feed).
- `saves`: `placeId ==` + `readableBy array-contains` (place graph).
Add to `firestore.indexes.json`; Firestore will also surface the exact index on first failed query.

### B.6 Migration (one script)

Backfill `readableBy` on every existing save: for each save, `readableBy = [uid,
...followersOf(uid)]`. Same logic as onSaveWrite, run once over the collection (admin SDK). Until
backfilled, a save with no `readableBy` is invisible under the new rule — so backfill **before**
flipping the rule.

### B.7 Edge cases & cost

- **New follower, old saves:** onFollow backfills them into your existing saves' `readableBy`, so a
  new friend sees your history immediately (desired). If that's *not* desired (only see saves from
  after the follow), gate on `ts >= followedAt` in the fan-out instead.
- **`array-contains` size:** a save's `readableBy` = your follower count. Firestore arrays hold
  ~40k elements / 1MiB doc — fine for a friend graph, not for a celebrity. If a user ever exceeds a
  few thousand followers, move them to model C for that user. Not a near-term concern.
- **Cost:** fan-out writes scale with `follows × avgSavesPerUser`. For a 4–6-person beta, trivial.
  At thousands of tight circles, still cheap (writes are $0.09/100k). This is the acceptable price
  of correct privacy.

## What to do, in order

1. **Now (pre-launch stop-gap):** the day the public demo closes, flip `saves`/`users` read to
   `signedIn()` (option A). One-line change; stops anonymous scraping immediately.
2. **Before inviting real, non-friend users:** build **B** — the `readableBy` field, the three
   fan-out functions + the follow callable, the query changes, the indexes, the backfill — and flip
   the rule to B.4. This also closes the `addMutualFollow` cross-user-write hole.
3. **Never:** ship a public (non-signed-in) build on the current `allow read: if true` rules.

## Open question for the owner

**Do new follows reveal your back-catalogue, or only your future saves?** (B.7). "Reveal the
back-catalogue" is the friend-graph-magic default (a new friend instantly sees where you go); "future
only" is more conservative. This is a product call that changes the fan-out, so decide it before B is
built.
