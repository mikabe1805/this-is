# this.is v2

> **Canonical implementation.** Approved group direction: [`../docs/product-reset/GROUP_DIRECTION.md`](../docs/product-reset/GROUP_DIRECTION.md). Product reset: [`../docs/product-reset/THIS_IS_RESET.md`](../docs/product-reset/THIS_IS_RESET.md). Detailed UX contract: [`../docs/product-reset/UX_ARCHITECTURE.md`](../docs/product-reset/UX_ARCHITECTURE.md).

this.is helps people build truthful place taste, then helps their recurring groups find where to go.

It is a private shared-taste memory for recurring groups of 2–6 people who make plans together—not a review site, public social network, generic discovery feed, map replacement, or fresh voting ritual. A person keeps a place as **Want**, **Tried**, or **Loved**, optionally adding one short note. Group views compute at most three places supported by existing history. A pair is the smallest group, not a parallel product.

The private note is a bounded practical memory—what to order, when the place works, or why the
person would return—not a public review. It enters a group candidate only through a separate exact-
share choice, is attributed, and is capped at 180 displayed characters.

The populated recommendation set still uses a development fixture, but the ordinary group lifecycle
is now production-shaped locally: authenticated server endpoints create a forming group, issue a
bounded invite, atomically accept members, explicitly project a saved place, lock the evidence
audience, and remove a departing member. Attendee-aware group Picks, post-visit closure, and a
privacy-redacted 30-day no-install chat receipt now work locally. Accepted pairs can explicitly migrate
into audience-identical two-member groups. Zero-history entry now offers optional Quick start,
Choose or find a place, and Not now paths; bounded Quick start hints can support only a clearly labeled weak
fit beside someone else's exact Want. Group candidate cards now distinguish known matches, named
introductions, and weak fits; they source their member-confirmed facts, disclose unknown constraints,
and use a warm place-mark fallback when no photo is available. Personal discovery begins with one
temporary typed area and a broad category. With Places enabled it shows at most three Google suggestions;
with Places disabled the same input produces a focused Google Maps handoff that opens the explicit query
at zero app API cost only when the person activates it. this.is stores neither the area nor a result. The
person shares or pastes one exact place back for review and private-first confirmation. A return to the
same live Discover screen may prefill its in-memory kind and area as editable review fields; cold exact
or shared links never inherit or infer them. Nothing is saved until confirmation, and no background Place
Details call occurs. No branch reads passive location or creates a location profile. Each supported in-app
suggestion can open its exact Google Maps page for current photos, descriptions, and reviews without a
Details call or app write; **Review** still makes the one Essentials-only Details request. A
successful personal confirmation now pauses on **Kept privately**. Only **Find another [kind]** starts
one fresh autocomplete session with the still-in-memory temporary area; **Done — view Keep** ends the
loop. That continuation is discarded on reload, route exit, sign-out, or account change and is never
written to a URL, browser storage, Firestore, analytics, or a group. A
long Google Maps URL carrying an exact Place ID is a separate zero-Places path: its readable path label
is only an editable seed, and the person still confirms the durable label, kind, and experience before
one private save exists. Coordinates and lookalike hosts never become place identity.
Automatic unfamiliar group retrieval and richer trust-weighted ranking remain unimplemented.

For group first use, **Choose or find a place** begins with the person's existing private Keep. It shows
at most three resolved private Want/Loved memories, owner-only and without notes or useful-detail
observations. Loved precedes Want, then newer memories precede older ones, with stable ties. Explicit plan
category and area filters are conjunctive and require known memory; missing data is unknown, not fit.
Opening a memory makes no Places request, creates no duplicate save, and shares nothing. It opens the
existing Closeup with one exact named-group row; only an explicit successful share to that same active
group returns to the group.

## Product surfaces

1. **Together** (`/together`) — recurring-group index and product front door.
2. **Group view** (`/g/:groupId`) — up to three candidates supported by members’ existing history, with exact reasons. An optional draft-only meeting area can filter only user-confirmed place areas; it is not persisted or treated as taste. Pair routes remain as implementation foundation during migration.
3. **Make a group Pick** (`/g/:groupId`) — choose the actual attendees, add optional situational context, see at most three unnumbered choices, and open one durable Pick.
4. **Keep** (`/saved`, capture in `/add` by name, Maps link, the installed app’s one-place share target, or `/add?mode=discover`) — the person’s Want/Tried/Loved memory. Discover asks for one temporary typed area and locally orders four broad prompts from private Want/Loved categories. With Places enabled, one tap makes one explicit session-tokened autocomplete search and displays no more than three suggestions; a supported suggestion may be previewed on its exact Google Maps page at zero additional app API calls, or reviewed with one explicit Essentials-only Details request. With Places disabled, the same tap produces and focuses an **Explore in Google Maps** handoff; activating it opens a zero-app-API-cost search for the explicit area/category query. this.is stores neither the temporary area nor a Maps result: the person chooses one exact place there, then shares it back or pastes its exact Maps link. If that link returns to the same live Discover screen, its in-memory person-chosen kind and area may prefill editable review fields. A cold exact link or incoming share never inherits or infers either field. The returned identity enters the same review and private-first confirmation before any named-group sharing; nothing is saved until confirmation and exact-link review makes no background Place Details call. This path never reads passive location, guesses where the person is, or creates a location profile. An exact long Google Maps link opens user-memory review from its Place ID without autocomplete, Place Details, the emulator stub, or the short-link resolver. The URL path label is editable rather than durable provider truth; nothing is saved until the person confirms their label, broad kind, and Want/Tried/Loved state. The canonical result is one private `g:` save with bounded `user_confirmed` memory. After a successful non-group Want/Loved capture, **Review sharing** reopens that memory without Place Details and focuses the named active-group rows. The person must choose each group explicitly; no group receives it automatically, and the canonical save remains private even while an exact server-owned projection exists. Coordinate-only and lookalike-host inputs fail closed. Incoming shares and discovery results are review-first and never auto-save. New capture requires an explicit broad place-kind choice rather than preselecting Other or deriving it from provider data; a same-live-screen Discover return may reuse only the kind the person already chose, and no Want/Tried/Loved experience is preselected. User-confirmed label/category/area can be corrected later without refreshing taste evidence or widening sharing. Historical `/search` links preserve their query parameters and redirect into Add; there is no separate discovery tab, feed, catalog, or map.
5. **People** (`/people`) — invite, connection, and relationship management.
6. **Place** (`/p/:placeId`) — canonical place facts, the current person’s signal, permitted circle evidence, and a Maps handoff.

Primary navigation is exactly **Together / Keep / People**. There is no Home feed or Explore tab in the current product.

A Group → Discover detour preserves selected attendees, the anonymous-guest flag, Food/Drinks/Coffee
context, explicit temporary area, and one practical need only in App-lifetime memory. None of that
continuity payload enters the URL, browser storage, Firestore, or analytics. Discover pre-fills the area
and visibly suggests the matching kind without searching; only a tap may start a provider request. Return
revalidates the signed-in member, exact group, `permissionVersion`, and current 2–6-member audience before
restoring the logistics and recomputing against current evidence. Reload or audience change resets it.
This behavior is locally browser-verified at 390×844; it is not production-readiness evidence.

## Product domain

The atomic object is:

```text
person × place × Want|Tried|Loved × optional note × timestamp
```

- Domain-only types live in `src/domain/signals.ts`; they do not depend on Firebase.
- Deterministic pair evidence lives in `src/domain/recommendation.ts`; approved 2–6 member aggregation lives in `src/domain/groupRecommendation.ts`.
- Both Overlap and Plan consume that one module so ordering and explanations cannot drift.
- Missing data is unknown, never consensus.
- The max-group browser case renders all six current members across Together, People, and planning. Its sixth member has no shared place history, so the same shortlist moves truthfully from `5 of 6` to `All 5` and back as attendance changes. Commitment preserves all six attendee identities; the place sheet, Together recovery, immutable current-Pick group state, and selected/visited public receipt retain the same bounded audience and honest count.
- Each repeated candidate action has one concise place-specific accessible name: choose, evidence disclosure, and attributed pass remain independently addressable. Candidate cards visibly say **Choose →** rather than relying on a navigation-like arrow, then **Chosen ✓** for the reversible pressed state; only the separate confirmation creates the group Pick.
- Shared future intent leads. A Loved place unknown to the other person becomes an introduction.
- Reciprocal introductions alternate so one person’s history does not dominate.
- Group eligibility requires support from at least two members, one explicit Love, or one exact Want plus an independent matching non-sensitive Quick start hint. The last form is labeled as a weak fit and never claims a second Want; any explicit veto removes the candidate. Missing remains unknown.
- Quick start foregrounds place-kind hints that can affect that current weak-fit path. Approved practical constraints remain editable but default under an **Optional for later** disclosure because they do not change current suggestions; **Not now** remains immediate and writes no taste evidence.
- A group draft may optionally filter by one non-safety-critical useful detail. It requires an attributed group-shared Yes, fails closed on any No or missing evidence, is displayed first when satisfied, and never changes support or rank. Area and need stay local while drafting; after explicit Pick confirmation, the server revalidates them from current projections and stores them only as bounded Pick context—not taste, a safety claim, or public receipt content.
- A pre-Pick `Not for us` is attributed and synchronized for one opaque draft identity, never a dislike. The hash changes with authorization, evidence, attendees, guest, intent, area, need, or recent Pick without storing temporary area text. Current members watch only the final shortlist's exact documents; only the actor can undo, at most three passes expire after six hours, and Pick creation revalidates and clears them.
- The first group-visible Quick start hint or place requires one modal review of the exact named current members. Commit sends a normalized request-only `permissionVersion` plus sorted `memberUids`; a stale server comparison writes nothing, triggers an authoritative refetch, and requires fresh explicit confirmation. Success locks invitations. Routine writes to that locked group normally skip another modal, removals are unstamped, and the stamp is never persisted to a URL, browser storage, Firestore, or analytics.
- Add may complete its canonical private Want/Loved save before stale audience review returns; it remains truthfully private until the refreshed names are confirmed. A stale Closeup included-detail update keeps current sharing unchanged when the person chooses **Keep current sharing**.
- A group has at most one selected Pick. Its server-owned group document carries a bounded current-Pick pointer so Together and the group page can recover it after reload; no Pick list or history is introduced. The open Pick leads with its bounded Google Maps handoff, places shared closure under **After the outing**, and keeps full private-memory maintenance behind one deliberate disclosure until closure. Closing clears the pointer, membership change dismisses it, and pair conversion retains only the newest selected legacy Pick as current.
- `We went` closes only the shared Pick. The terminal screen says the original attendee count **were on the plan**, keeps the Pick reason as history rather than an active recommendation, retains the 30-day receipt, and lets each attendee independently keep Tried or Loved. A bounded Last Pick pointer lets the group start a new draft; a new Pick replaces it, and personal outcomes never claim group agreement.
- `Not for us` closes the group Pick without changing anyone's Keep, creates no Last Pick, removes the group Maps, receipt, and closure actions, and keeps the former reason only as considered history. The person may still privately choose Want, Tried, or Loved or open secondary **Directions for me**; neither action changes or reopens the group outcome.
- The open-catalog shortlist policy is separate from known-place recommendations. It requires an
  explicitly chosen bounded plan area, current group-visible category evidence, open-source field
  provenance, and at least one real Want/Love before a hint can help. The authenticated
  `/searchPlanAreas` function now provides a dark, group-scoped server boundary for a future global
  GeoNames picker: one remotely enabled object path, strict byte/SHA-256/snapshot/license/count
  validation, five results, and aggregate-only usage. No reviewed artifact, enabled success path,
  client picker, or unfamiliar-place service exists yet, so unfamiliar discovery remains unavailable.

## Data and privacy

- `saves/{uid}__{placeId}` stores one denormalized signal per person and place.
- `users/{uid}` stores profile data. The old `following` array is now migration-only.
- `invites/{token}` stores a revocable, non-guessable, seven-day entry link with no place history. It carries only a rules-bounded inviter name/avatar snapshot so the recipient knows who invited them before sign-in. Acceptance and connection creation are one atomic, single-use claim.
- `connections/{pairId}` stores explicit two-person membership; opening a link never creates a relationship.
- `groups/{groupId}` is the server-authored 2–6 member read boundary. Its `permissionVersion`
  invalidates stale `groups/{groupId}/signals` projections and `preferences/{uid}` Quick start hints
  after membership or audience changes; clients cannot write any of those document classes.
- Closeup checks one deterministic projection document per active group to render the owner's sharing state.
  Firestore permits an active member to read only their own absent projection ID; probing another
  member's missing projection ID is denied.
- `groupInvites/{token}` is a seven-day, single-use bounded preview. The first explicit group signal
  locks membership so later invitations cannot silently expand the audience of existing evidence.
  The exact first-share audience stamp exists only on the trusted request; group and projection
  documents retain the canonical permission version and member boundary, never a copied review object.
  Creator cards lead with Copy / Share / Cancel and conceal raw URLs by default; **Show full link** is
  the explicit manual-copy fallback, not persistent token decoration.
- Group-shaped `picks/{id}` records preserve the accepted membership snapshot, actual attendee
  subset, permission version, one place, and a server-derived reason. Current members may read them;
  only attendees may close them through trusted code.
- `users/{uid}/events/{eventId}` stores write-only aggregate milestones with a rules-bounded 30-day `expiresAt`. Rules forbid reads and reject identifiers, arbitrary text, unbounded counts, missing expiry, and extended raw retention; the index manifest enables Firestore TTL and exempts its sequential field from indexing.
- Pair views are computed from signals and are not stored as a second source of truth.
- `picks/{id}` stores the smallest durable decision: bounded members/attendees, one user-confirmed place memory, one truthful reason, context, and a terminal `selected → visited|dismissed` lifecycle. Group documents carry at most one current pointer and one replaceable last-visited pointer; personal Tried/Loved remains canonical only in each person’s save.
- `v2/firestore.rules` contains the explicit circle/private visibility cutover target. It has **not** replaced the live v1 rules.
- The v2 authorization rules are emulator-tested, but the cutover remains undeployed and the live v1 prototype backdoor must still be replaced before launch.

Google Places remains a cost-controlled logistics backend. Preserve minimal field masks, the photo budget, caching, and explicit-details-only behavior described in [`docs/GOOGLE.md`](docs/GOOGLE.md).

Maps-link capture follows Google’s documented URL contract: `query_place_id` or an exact embedded Place ID is authoritative, its readable URL label is only an editable confirmation seed, and coordinates alone are never guessed into a place. Exact long links are parsed locally and issue no autocomplete, Place Details, emulator-stub, or resolver request. Only a return to the same live Discover screen may reuse its in-memory, person-chosen kind and area as editable review seeds; cold exact links and incoming shares receive neither. Google-lookalike hosts and coordinate-only URLs cannot open review. Even an accepted link writes nothing until the final user confirmation creates one private, user-confirmed `g:` memory. Opaque `maps.app.goo.gl` links are expanded only by the authenticated, allowlisted `v2-functions/` resolver; if the resolved URL has exact identity, it then follows the same zero-Details review path.

Legacy data is not imported directly. The repository-root read-only planner follows [`docs/product-reset/MIGRATION_PLAN.md`](../docs/product-reset/MIGRATION_PLAN.md), skips unknown sentiment/identity, and never overwrites existing v2 signals.

Firestore uses persistent local caching. When the browser goes offline, the app explicitly says
that saved data is shown only when available, reports last-online time rather than claiming cache
freshness, and retries paused writes and active queries after reconnecting. In production, v2 also
registers a content-addressed service worker that caches only the owned app shell, code, styles, icon,
and manifest. Navigation stays network-first, development stays worker-free, and API responses,
personal/group documents, Google photos, and public Pick receipts are outside the worker cache. This
lets an installed build open while cold offline without claiming that signed-in data is available.

Permission failures never fall through to partial pair evidence: the relationship view explains
that sharing changed and routes to connection review. Place pages prefer the saved signal snapshot,
so a failed optional Google lookup cannot erase the person's name, state, or note; a genuinely
unknown place instead gets search/retry actions and no fabricated Maps handoff.

## Run and verify

```bash
npm install
npm run dev           # Node 22; full local Auth/Firestore/Functions emulators
npm run lint           # from the repository root
npm test             # domain invariants + Firestore authorization
npm run typecheck
npm run build
npm run verify:zero-api-link-ui # Places-off discovery + exact Maps-link browser proof
```

Canonical `npm run dev` cannot connect to the legacy Firebase project: it loads the tracked
demo-only `.env.emulator`, starts Auth, Firestore, and Functions under `demo-this-is-v2`, and proxies
the app's same-origin HTTP endpoints to the Functions emulator. Local Places and photos stay off.
Direct non-emulator Vite serving is refused before the app initializes.

Family dogfooding on real phones is a separate release channel, not a production cutover and not a
research cohort. Copy `.env.family-alpha.example` to the ignored `.env.family-alpha.local` only after
creating an empty, separate Firebase project, then run `npm run family-alpha:check` and
`npm run family-alpha:build` from the repository root. The strict parser reads only that dedicated
allowlist: malformed, unknown, duplicate, missing, or placeholder keys fail, as do legacy/demo or
mismatched project metadata, Firebase/Places key reuse, tracked legacy key reuse, ambient overrides,
including ignored `.env.local` and disabled-prefix injection, emulators/stubs, and photos. Diagnostics
name fields without echoing credentials. The build generates ignored Firestore rules that add a
`familyAlpha == true` custom-claim requirement to the existing `signedIn()` boundary and an ignored
Functions package whose authenticated HTTP handlers apply the same token gate. Its exact 19-Function
surface also includes the reviewed Firestore triggers and opaque-token Pick receipt, and physically
omits `placePhoto`, `PLACES_SERVER_KEY`, and `migratePairToGroup`. The app artifact is written only to
ignored `v2/.family-alpha-dist`, leaving canonical `v2/dist` untouched, and is verified after emission
for its visible marker, exact public config, owned precache, and legacy/photo leakage.

`firebase.family-alpha.json` points only to those generated backend and Hosting artifacts. `.firebaserc`
has no default project and retains production only behind the explicit `legacy` alias, so future alpha
work must name its separate target. No family-alpha deploy or claim-provisioning command exists;
creating/configuring the external project, restricting keys, reviewing quotas/billing, granting the
claim to reviewed family accounts, and authorizing a first deployment remain explicit owner actions.
An unclaimed account cannot use Firestore or authenticated HTTP paths. A valid local artifact is not
cloud or production readiness. `npm run family-alpha:verify-rules` proves the claimed/unclaimed split
against a `demo-` Firestore emulator without contacting a Firebase project.
The separate [`family-alpha operator runbook`](../docs/product-reset/FAMILY_ALPHA_RUNBOOK.md) records
the external console checks, merge-preserving claim changes, token-refresh/revocation boundary,
deployment order, and rollback evidence that local code cannot prove.

The family-alpha client also withholds every data-capable route until the current ID token contains
the exact boolean claim. Token changes re-check it, **Check again** forces a refresh after approval,
and denial, sign-out, or an account switch clears the in-memory React Query cache before another
identity can render the app. The friendly pending screen contains no account, group, or place data and
profile creation begins only after approval. Firestore's origin-scoped persistent IndexedDB cache is
not erased by this UI gate; an unapproved session mounts no reader for it, but alpha participants must
still use a private device (or clear this site's browser data before handing the device to someone
else). A future shared-device requirement would need a separately reviewed cache-lifecycle design.
Removing the custom claim is also not an instant Firestore-token revocation: an already issued ID token
can remain rules-valid until it refreshes or expires. Offboarding must revoke refresh tokens as well as
remove the claim, and the operator must treat the existing token lifetime as the revocation window.

`firebase.emulator.json` loads `v2/firestore.rules` against a demo project. The suite exercises 104 non-deploying authorization and lifecycle cases for bounded profiles/events, private user-authored observations, optional bounded user-confirmed place areas, event retention, the deletion write lock, group invitations, retired pair creation, groups, Quick start audience/version boundaries, migrated-pair revocation, bounded Picks/signals, private receipt storage, immutable canonical places, circle/private access, and retired public surfaces. Root integration commands additionally exercise pair conversion, zero-history Quick start, weak-fit Picks, group/receipt lifecycle, malformed share actions, and exact-index projection sync across delayed events and true save recreation, proving stale prior-lifetime consent is removed without a member-group scan. A focused 390×844 browser branch is green for exact named first-share review, safe cancellation, authoritative stale-circle refetch, private-before-share Add recovery, unchanged Closeup sharing on cancel, locked repeat writes, unstamped removals, and exact replay. This is local development evidence, not pilot validation or production readiness. A separate production-mode build runs two isolated authenticated browsers against those emulators to prove attributed draft-pass synchronization, actor-only undo, stale-selection invalidation, and exact draft-identity reset. The same run proves a non-group Want capture stays canonical and private, offers **Review sharing**, reopens its user-confirmed memory with no Details request, and focuses named active-group rows. One explicit choice reaches exactly one group and becomes visible there to the other member; another active group and one forming group receive nothing, while explicit removal restores isolation. The development artifact is `private-save-review-sharing-mobile.png`. Its same-origin Places stub also proves that personal discovery makes one autocomplete plus one Essentials-only Details request without reaching Google; group-scoped Add reads one audience document and gates private Keep on its active authorization; prefilled text cannot search early; exact-ID/bounded-schema Details reject an identity mismatch without saving or projecting; and explicit named-group sharing retracts on Tried without leaking to other audiences. The dedicated `verify:zero-api-link-ui` build instead keeps both Places and that stub off and injects one onboarded Auth-emulator user at 390×844. It covers the explicit area/category Google Maps handoff without a provider, resolver, result, or save request, then proves an exact long URL uses no resolver or provider request, checks the editable path label and pre-confirmation absence, and inspects the exact private Firestore memory; coordinate and lookalike rejection are included. These are local emulator/browser checks, not production deployment or readiness. Observability checks then prove write-only event delivery plus an expiry-aware pilot summary whose aggregates contain no identities or place history.

`v2/firestore.indexes.json` declares the collection-group composite on `signals(uid, placeId)` required by
projection synchronization. Local tests require an already-current replay to leave both the projection
and group document timestamps unchanged. This does not prove production index availability: deploy the
index in the reviewed target project, wait until Firestore reports **READY**, and only then roll out the
projection-sync Functions.

Canonical lint runs from the repository root and scopes ESLint to `v2/src` and `v2-functions/src`. The production build also includes TypeScript checking.

### Budgeted live photos

Final-three group candidate and explicit saved-place closeup photos are deliberately dark by default.
Keep and search grids always use the designed place mark until user-owned imagery exists.
`VITE_GROUP_PHOTOS_ENABLED=true` is the retained historical name for the single budgeted-photo client
switch; it only enables the proxy request path. The authenticated `/placePhoto` function independently fails closed
unless the operator-owned `serviceConfig/placePhotos` document contains `enabled: true` and a valid
`monthlyLimit` from 1–999. It accepts only current candidate evidence in one of the caller's active
groups or a canonical save owned by the caller, stores only an aggregate UTC-month count, streams uncached image bytes, and returns the
photo-specific Google Maps source. The `PLACES_SERVER_KEY` Functions secret must be a separate,
API-restricted server credential. Do not enable either side until Cloud quota, key restrictions,
billing alerts, SKU telemetry, and schema-v2 cutover evidence have been reviewed. The amber place
mark remains the normal and exhausted-budget state.

### Development-only pair fixture

Run the dev server, then open:

```text
http://127.0.0.1:5173/together?prototype=group
```

The fixture seeds the real TanStack Query keys and session used by Together, Group, and Place; persists Picks and signal overrides only for the development tab; and suppresses Firebase and Places requests for invented IDs. `import.meta.env.DEV` removes the fixture import and its sample data from production builds. It exists for reproducible visual and interaction QA—not as demo data or a cold-start strategy.

### Development-only group fixture

Run the dev server, then open:

```text
http://127.0.0.1:5173/together?prototype=group
```

This exercises recurring groups, exact support/unknown/veto explanations, context filtering, a maximum of three candidates, and reversible selection. It performs no Firebase or Places work and must remain absent from production bundles.

## Visual system

The starting system remains Salon Madder: oxblood canvas, bone text, madder action, Fraunces display type, Inter utility type, and JetBrains Mono evidence labels. The distinct product signature is the **convergence field**—two irregular traces resolving around a few place apertures—not generic dark luxury or candlelit restaurant imagery.

See [`DESIGN.md`](DESIGN.md) for tokens and [`../docs/product-reset/UX_ARCHITECTURE.md`](../docs/product-reset/UX_ARCHITECTURE.md#visual-signature) for the current art-direction ruling and generated studies.

## Historical documents

[`BRIEF.md`](BRIEF.md) and [`FRIENDS.md`](FRIENDS.md) preserve earlier pivots. They are historical evidence, not current product authority. When they conflict with the product-reset documents, the reset documents win.

## Cutover status

v2 imports nothing from the v1 application tree and can be lifted out independently. Production still shares the legacy Firebase project until an explicit cutover; local development no longer does. Do not deploy v2 rules, hosting, or functions over the live app without a reviewed migration plan. Family alpha must use a separate empty project.
