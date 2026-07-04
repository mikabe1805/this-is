# this.is v2 — Roadmap

*Synthesized from a six-dimension adversarially-verified audit (2026-07-03) and updated as work
lands. Source of truth for direction: `FRIENDS.md`. Ranked by leverage toward the friend-graph
vision ("discovery of friends' tastes").*

---

## ✅ Done (session 2026-07-03)

The app didn't build and the friend graph had no front door; both are fixed, plus a polish pass.

- **Build unblocked.** `useFriendFeed()` was passing a `uid` string where `fetchFriendFeed`
  expected a `following: string[]` (typecheck failure + runtime crash). It now reads your
  `following` list and refetches when your circle changes.
- **The invite / follow loop** — the friend graph's front door (FRIENDS.md task 1):
  `/i/:uid` mutually follows you both and drops you into a feed already full of their rooms;
  Settings → **Your people** copies your invite link and prunes whom you follow (the
  auto-followed tastemakers are removable, as promised).
- **Wall no longer crashes signed-out** — a `useMemo` sat after a conditional early return
  (Rules-of-Hooks violation); hooks are now unconditional.
- **The bookmark no longer destroys tags** — re-tapping a Loved room on Search/related used to
  silently demote it to Want; a saved card now shows its tag and opens the closeup to manage it.
- **Onboarding is reachable** — a lazy first-run gate sends a signed-in, un-onboarded user into
  the vibe picker (from the home landing only; never hijacks a deep link or an invite).
- **Home is honest + has travel magic** — Layer 2 now sources the geo-cell candidate pool and
  only labels genuinely-near rooms "NEARBY & UNEXPLORED" (far curated rooms sit under "ON THE
  LOW-LIT LIST", no false proximity). New **YOUR PEOPLE HERE** section surfaces friends' Loved
  rooms within a short walk right now (verified-idea #3). Fixed the false "Quiet in here" flash.
- **Polish:** the `.avatar-initial` class had no CSS (avatars were un-rounded squares) — fixed
  app-wide; Wall reserves the `--celebrate` picture-light for Loved only; a global
  `:focus-visible` ring; `aria-pressed`/labels on the save control; a theme-aware EmptyScene
  (was invisible in Day); Closeup remounts per place (kills a note-lifecycle edge case).
- **Rules:** the `saves` delete arm now checks the existing doc (`resource.data.uid`) so unsave
  survives cutover; `isDevMode()` flagged as the #1 launch blocker in-file.
- **Dead code & docs:** deleted `ranking.ts` + `photos.ts` (bound to the deleted pin/board
  model), slimmed `types.ts`, rewrote the owner-import script to write flat `saves`, and
  reconciled README / CLAUDE / DESIGN / DIRECTION / FRIENDS / the v2 rules draft so they no
  longer describe boards/pins/TONIGHT/morning-after.
- **Identity (Next #3):** a "Who are you?" onboarding step (name + avatar color) and an editable
  **YOU** section in Settings — friends now recognise each other by a chosen name/avatar, not a
  machine guess. (`updateProfile`, `AVATAR_PALETTE`.)
- **The Overlap (idea #2 — shipped):** `/with/:uid` — tap any friend (feed or spot page) for a
  private pairwise view: **YOU BOTH** (rooms you've each kept, both-Loved first) and **WHERE THEY
  CAN TAKE YOU** (their Loved you haven't). Pure set-ops over `saves`; strictly pairwise, no
  leaderboard.
- **The tactile reveal (Next #6 — partly shipped):** the Loved acquisition sweeps a picture-light
  across the spot-page hero + a fuller `celebrate` haptic, and the **Wall glows** where a friend
  also Loved a room you Loved. *View transitions (the card→spot reveal + shared-element morph) were
  attempted and **removed** — React Router's `viewTransition` / `useViewTransitionState` require a
  **data router** (`createBrowserRouter` + `RouterProvider`), but the app uses the declarative
  `<BrowserRouter>`, so the hook throws (and the navigate option silently no-ops). See Next-#7.*
- **"The want that got loved" (idea #5 — shipped):** a spark card at the top of Home when a friend
  just Loved a room on your Want wall — the moment a someday-Want becomes tonight's plan.
- **Build determinism:** v2 had no `manualChunks`, so Rollup nondeterministically folded firebase
  into the entry (85↔100kB gzip swings). Pinned firebase + react-router + tanstack + minisearch to
  their own chunks — entry is now a deterministic **60.6kB gzip**, firebase (dynamic-only) fully
  isolated. (Also: watch the shell cwd — v2 builds/typechecks must run from `v2/`, not the root.)

---

## Next — high-leverage, ranked

| # | Improvement | Effort | Why |
|---|---|---|---|
| 1 | **Lock the friend-graph security posture before beta** (`firestore.rules`) | M | `isDevMode()` (`request.time < 2030`, no auth check) short-circuits every write rule true for anonymous callers — anyone can forge/delete any save and wipe the `curated` catalog. Gate it behind an emulator/env flag or delete it; move `curated`/`candidates` writes to the Admin SDK. **Launch blocker.** The v2 rules draft (`v2/firestore.rules`) already models the correct target. |
| 2 | **Restrict `saves`/`users` reads to the follow-graph** — **design now in [`docs/READS.md`](docs/READS.md)** | L | Today the whole friend graph + intimate notes are world-readable. The design is decided (a `readableBy` denormalization + a Cloud-Function fan-out on follow/unfollow; auth-only reads as the pre-launch stop-gap). Needs owner sign-off on one product call (do new follows reveal your back-catalogue?) then build. Also closes the `addMutualFollow` cross-user-write hole. |
| 3 | ~~Handle + avatar at sign-up~~ ✅ **shipped** — name + avatar at onboarding + editable in Settings. (A unique `@handle` is still auto-derived; not surfaced/editable, but there's no people-search that needs it yet.) |
| 4 | **"Snap it when you save it" user photos** (`saves.ts`, `social.ts`, `Closeup.tsx`) | L | The pixel-ownership grid strategy is unbuilt: no photo field on a save, no capture UI. Add optional capture at save time → Storage → denormalize URL into the save snapshot → prefer as card hero. Unblocks getting Google photos off the grid. (`photos.ts` was deleted; rebuild against `saves`, not `pins`.) |
| 5 | **Server-side / lowered photo budget + confirm GCP budget alerts** (`photoBudget.ts`) | M | The 25/day cap is per-browser localStorage (~750/mo *each*, trivially reset); a small beta can blow past the project-wide 1,000/mo free Photo SKU. Lower the cap, move the true cap server-side, verify GCP budget alerts exist. |
| 6 | **The tactile reveal** (FRIENDS.md task 2) | M | ✅ *mostly shipped* — Loved sweep + celebrate haptic + the Wall both-Loved glow. View transitions deferred to #7. |
| 7 | **Migrate to a data router for view transitions** (`App.tsx`) | M | `useViewTransitionState` + `navigate({viewTransition})` only work under `createBrowserRouter`/`RouterProvider`, not the declarative `<BrowserRouter>`. Migrate routing (Chrome/Dock/OnboardingGate become a root layout route), then re-add the card→spot reveal + the shared-element card→hero morph — and guard the "MORE ON THE LIST" case (a related-card tap must not put `view-transition-name` on both the old hero and the tapped card). Verify on-device (Chromium). |

---

## New ideas worth pursuing (verified on-thesis, NEVER-list-safe)

1. **The Housewarming** — an invite that opens onto the inviter's Loved wall as the literal first
   screen ("Maya invited you. This is where Maya goes."). *(Partly shipped: `/i/:uid` mutual-
   follows and lands you in a feed of their rooms; the next step is to make the inviter's wall the
   first screen before redirect.)*
2. ~~The Overlap~~ ✅ **shipped** — `/with/:uid`: "YOU BOTH" + "WHERE THEY CAN TAKE YOU", pure set
   ops on `fetchMySaves`, strictly pairwise.
3. **Your people wherever you land** *(shipped as YOUR PEOPLE HERE)* — friends' Loved rooms near
   your current cell. The reason the app gets forwarded; extend it with the walk chip on the card.
4. **The room through your people's eyes** — a small silent photo album per place (one photo per
   friend who saved it), above the FriendGraph. Depends on user-photos (Next #4). ToS-clean.
5. **The want that got loved** — once per session, if a friend just Loved a place on your Want
   wall, float one quiet card: "You've wanted Café Kobalt since March. Uri just loved it." The
   moment a someday-Want becomes tonight's plan. Pure `myWants ∩ friendFeed.loved`.

---

## Risks & watch-items

- **`isDevMode()` is a loaded gun on a "launch-serious" beta** — world-writable/readable DB until
  2030. Next-#1/#2 are launch blockers, not polish. (The delete-arm bug is already fixed so
  tightening rules won't break unsave.)
- **Photo spend is unbounded at the account level** — the only real backstop is a GCP budget
  alert; confirm it exists before inviting anyone.
- **Read-scoping the friend graph is design debt, not a rules tweak** — decide the read model
  before beta or ship the leak.
- **Onboarding + identity are coupled** — build the handle/avatar step *with* the onboarding wiring
  so the first-run flow is built once.
