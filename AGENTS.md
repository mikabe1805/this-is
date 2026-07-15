# AGENTS.md

## Authority

This repository contains history, but only one active product:

- `v2/` — canonical React application.
- `v2-functions/` — canonical minimal Firebase backend.
- `docs/product-reset/` — canonical product, UX, validation, migration, and cutover record.
- Root `src/`, `functions/`, `firestore.rules`, and `firebase.json` — frozen v1/live-legacy reference. Do not add product work there.
- `C:\Users\mikus\this-is-v2` — superseded dirty clean-room experiment. Do not copy, reset, move, delete, or archive it without explicit owner approval.

When documents disagree, use this order: `docs/product-reset/GROUP_DIRECTION.md` → `THIS_IS_RESET.md` → `UX_ARCHITECTURE.md` → `CURRENT_STATE.md` → `v2/README.md`.

## Product

this.is helps people build truthful place taste and helps a recurring group of 2–6 people **find where to go**. A pair is the smallest valid group, not a separate product thesis.

Each person keeps a place as Want, Tried, or Loved, with an optional short note and explicit private/group visibility. When nothing comes to mind, Discover inside Keep/Add uses one person-typed temporary area, locally orders broad prompts from private Want/Loved categories, and performs one explicit Google autocomplete search; it never stores a location profile or automatically shares private history. Together computes truthful support from the group’s accumulated taste, offers no more than three reasoned candidates, creates one small Pick, hands routing to Google Maps, and later closes the Pick as Tried, Loved, or Not for us.

The group direction is approved but remains development-only. The current Firestore rules, connection records, and Picks are a two-person foundation and must not be represented as production-ready group authorization or storage.

Primary IA is exactly **Together / Keep / People**. Personal discovery remains an action inside Keep/Add, not a fourth tab, feed, or map. Do not revive public profiles, followers, hubs, boards, lists, rankings, crowd ratings, swipe decks, generic maps, editorial catalogs, or AI ranking without a new explicit product decision.

## Canonical commands

Run from the repository root:

```bash
npm run dev
npm run runtime:check
npm run lint
npm run typecheck
npm run build
npm test
npm run status:cutover
npm run docs:check
npm run verify:hosting
```

Default commands target canonical v2. Every executable legacy operation is suffixed `:v1` (for example `dev:v1`, `build:v1`, `db:deploy:v1`, `status:ui:v1`, `test:smoke:v1`). Do not use a `:v1` command for canonical work.

## Canonical structure

- `v2/src/App.tsx` — route shell and dock policy.
- `v2/src/pages/` — Together, Overlap, Plan, Saved/Keep, People, Search/Add, Closeup, Invite, Onboarding, Settings.
- `v2/src/domain/` — Firebase-free signals, recommendation, Pick, and Maps URL invariants.
- `v2/src/data/` — query and persistence boundaries.
- `v2/src/lib/places.ts` — cost-controlled Places API surface.
- `v2/firestore.rules` — cutover authorization target; 80 emulator cases.
- `v2-functions/src/` — Maps short-link resolver plus owner export/deletion.
- `scripts/plan-v2-migration.mjs` and `scripts/plan-v1-erasure.mjs` — read-only planners; never turn them into implicit apply commands.

## Product and data laws

- Missing data is unknown, never consensus.
- Group evidence uses only explicitly group-visible signals from current members.
- Group recommendations are computed from an authorized server-owned projection; personal `saves` remains canonical.
- Existing pair views and Picks are a two-person implementation foundation pending the approved group migration.
- Picks have a bounded `selected → visited|dismissed` lifecycle.
- Raw events are write-only, identity-free, schema-bounded, and expire after 30 days.
- Canonical place facts are client-immutable.
- Account export/deletion must cover every canonical personal-data surface.
- Never read or mutate production data while developing or validating locally.

## Google Places cost rules

- Preserve existing minimal field masks and session-tokened autocomplete.
- Place Details occurs only after explicit user action.
- Never add paid fields or background detail calls without approval.
- Use the existing photo budget and attribution path; do not place Google photo URLs in plain `<img>` elements.
- Coordinates alone never become a guessed place identity.
- Maps short links resolve only through the authenticated Google-host allowlist.

## Working safely

- The worktree is intentionally dirty. Preserve unrelated user work and inspect overlap before editing.
- Use `apply_patch` for edits. Do not reset, clean, checkout, or bulk-move user changes.
- Add product flags only when an experiment genuinely needs one; remove flags when the decision lands.
- Prefer deterministic rules and observable user evidence over new AI services.
- Verify UI changes at 390×844 with the development-only group fixture when relevant (`/together?prototype=group`).

## Deployment

Production remains legacy. `npm run firebase:deploy` runs `cutover:check` and must continue refusing deployment while any gate is blocked. Do not bypass it with a raw Firebase deploy command.
The reviewed gate also requires ignored `cutover-evidence.local.json`; never fill it with invented
values, participant identifiers, or evidence that has not actually been reviewed.

Before any reviewed cutover, follow `docs/product-reset/CUTOVER.md`: real-group pilot, group storage and authorization, pair migration, migration reconciliation, hosting, cost, observability, data rights, rollback owner, and external-prototype archive decision.
