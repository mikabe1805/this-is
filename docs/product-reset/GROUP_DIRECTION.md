# this.is — group-native direction

**Status:** approved product direction; attendee-aware Pick loop and zero-history entry implemented locally  
**Date:** July 11, 2026  
**Visual baseline:** [`group-amber-baseline.png`](visuals/group-amber-baseline.png)
**Discovery mechanics:** [`DISCOVERY_ENGINE.md`](DISCOVERY_ENGINE.md)

## Decision

this.is is the shared place memory that helps **your people** decide where to go. Persistent groups
of **2–6 people** are the primary relationship object. A pair remains valid, but it is the smallest
group—not the product's entire emotional center.

> Help the group chat decide where to go using what everyone already knows and likes.

This expands the behavior from unusually intimate pairs to dinner groups, recurring friend circles,
visitors, trips, families, and small work/social groups without reviving a feed, public graph, map
homepage, or fresh voting ritual.

## Product boundaries

- Initial group size is 2–6. Larger groups behave more like events and are out of scope.
- Groups persist long enough to accumulate taste memory; a Pick remains temporary.
- Each plan names its actual attendees from the group and may include one explicitly invited guest.
  Evidence, denominators, and fairness use attendees—not every standing member. A guest contributes
  only to that plan and does not silently join the persistent group.
- Exactly three unnumbered candidates remains the default decision surface.
- Missing evidence remains unknown. “3 of 5” must never become “the group agrees.”
- One explicit plan veto removes a candidate. Vetoes are attributed social actions: “Ari passed.”
  Anonymous veto is not promised because it is mathematically and behaviorally inferable in groups
  of two or three. The control must preview that attribution before submission.
- A single Love can introduce the group somewhere, but the reason names the introducer and states
  how many people have not weighed in.
- No compatibility percentage, star average, popularity rank, or follower count.

## Recommendation contract

Eligibility requires either positive Want/Loved evidence from at least two members, one explicit
Love as a clearly labeled introduction, or one exact shared Want plus an independent attendee's
matching non-sensitive Quick start category hint. The last form is labeled a weak fit and never
claims the second person wanted the exact place. Ranking is deterministic before machine learning:

```text
hard veto → support breadth → Want/Love strength → freshness → context fit
```

For a current decision, Want is slightly more actionable than Loved because it expresses unfulfilled
intent; Loved is stronger evidence for taste learning and trusted introductions. The production
ranking and tests must preserve that distinction rather than using one universal weight.

Current truthful reason forms include exact support, named introductions, and the bounded weak-fit
form `Mika wants this; it fits Vivian's food hint.`:

- “All 5 want this.”
- “3 of 5 want or love this.”
- “Dev loved this; 4 people haven’t weighed in.”

The pure domain implementation is `v2/src/domain/groupRecommendation.ts`. It supports exactly 2–6
unique members, filters vetoes before ranking, preserves unknowns, reuses Food/Drinks/Coffee context,
and caps the result at three.

## UX

Together opens with recognizable recurring groups:

```text
Together
├── Friday Table · 5 people
├── Brooklyn Friends · 4 people
└── Mika & Vivian · 2 people
```

A group opens into member identity, one material statement field, current attendees/category, three
reasoned candidates, a reversible local selection, and the place/Maps handoff. Optional area and one
practical need sit behind a compact Plan details disclosure; applied values remain visible in its
collapsed summary, so progressive disclosure never becomes hidden state.

Opening **Choose or find a place** from that draft carries its selected attendees, anonymous-guest flag,
Food/Drinks/Coffee context, explicit temporary area, and one practical need only in App-lifetime
memory. During this detour the continuity draft enters no URL, browser storage, Firestore document, or
analytics event. Discover may prefill the area and visibly suggest the matching kind, but it makes no
provider request until the person taps a direction. Return first revalidates the signed-in member, exact
group, `permissionVersion`, and current 2–6-member set, then restores the logistics and recomputes from
current shared evidence. Reload or any audience mismatch clears the draft instead of reviving stale
people or context.

Before asking for another search, group-scoped Add reuses the member's existing private Keep. It shows
at most three resolved private Want/Loved memories under **From your Keep - only you**. Loved precedes
Want, then newer memories precede older ones, with stable ordering for ties. An explicit plan category
and area are conjunctive filters: a memory with unknown category or area is unknown fit and is excluded;
without either filter, any resolved private Want/Loved memory may appear. The cards omit private notes
and useful-detail observations, and opening one shares nothing. It opens the existing place review with
one exact named-group row. Only an explicit successful share to that same still-active group returns to
the group; no generic Closeup visit auto-returns. The bridge makes no Places request and creates no
second save.

The development-only
route `/g/:groupId?prototype=group` proves the populated shape. The ordinary lifecycle now creates a
forming group, issues a bounded invite, atomically accepts 2–6 members, and lets the owner explicitly
share a saved place—with the note excluded unless separately checked. The first share locks the
accepted membership audience, preventing a later invite from exposing earlier evidence. Each current
unexpired invite reserves one remaining seat transactionally, so active links plus members cannot
exceed six; audience lock or the sixth acceptance revokes every surplus link, and seven-day TTL then
deletes invitation records asynchronously. A creator can prepare and independently manage several
one-person links for a larger group. The organizer UI states **One link · one person** before the first
token exists, asks them to make a separate private link for each person, and never tells them to paste
one consumable link into the whole group chat. On return, an authenticated endpoint recovers only that member's
active links for that group, bounded to five; direct Firestore collection listing remains denied.
Before use, only the member who created a link can manually revoke it; revocation changes no current
membership or taste evidence. Creator revocation is retry-safe while that creator remains a current
member: exact replay returns success without rewriting the original revocation, while every other
identity and every non-creator revocation reason remain denied. If the response is ambiguous, that
token loses Copy, Share, Cancel, and full-URL disclosure; the organizer sees only **Check link** and
copy that says checking can revoke the same link but cannot restore or replace it. While a group page is open, one
listener watches only its group document so newly accepted members appear without polling. Membership-
only changes merge with empty/unknown taste for the newcomer; permission, audience-lock, or projection
changes force a complete authorized evidence refetch. Each invite URL displayed to its creator has a
narrow exact-token listener; acceptance, revocation, or deletion removes only that stale URL immediately.
Firestore permits only direct exact-token preview reads and denies every invite
collection listing, including active-status queries. The route
also renders honest loading, revoked-access, unavailable, forming, and zero-signal states. Active
groups can select an attendee subset; recommendations and denominators recompute immediately. A
trusted endpoint then re-derives the reason from current projections before saving a durable group
Pick, and only signed-in group-member attendees may close it as visited or dismissed. The Pick now
creates a 30-day no-install receipt with an opaque URL and a direct Maps handoff. It does not yet
claim unfamiliar catalog retrieval or deeper adaptive learning. A group has at most one selected
Pick at a time. Its private group document carries only a bounded recovery pointer, so Together and
the group page can reopen the decision after a reload without listing Pick history. A second Pick is
refused until the current one is visited or dismissed; closure removes the pointer, while membership
change dismisses it and revokes its public receipt. Pair conversion chooses the newest selected
legacy Pick as current and dismisses any additional selected rows. A visited Pick becomes one
bounded `Last Pick` pointer rather than disappearing: the group may immediately start a fresh draft,
but that recent place is suppressed from the shortlist until a different Pick replaces the pointer.
Each attendee can still return and independently keep the place as Tried or Loved. The visited screen
labels the immutable attendee count as **were on the plan**, keeps the original Pick reason as history,
and retains the member-revocable 30-day receipt. `We went` never changes a personal save; personal outcomes never claim group agreement. If an attendee has no prior
personal save, the Pick's chosen user-confirmed label, category, and optional area prefill an editable
confirmation instead of triggering speculative provider Details. Nothing is written until that person
confirms; the resulting memory defaults private and is not projected back to any group automatically.
Because durable dismissal
closes the Pick for every attendee, `Not for us` requires a consequence confirmation with safe cancel
and Escape recovery; it revokes any receipt, creates no Last Pick, changes no personal Keep, and removes
the group Maps, receipt, and closure actions. Its terminal screen keeps the former reason only as
considered history while still offering private Want/Tried/Loved and secondary personal Directions;
neither action changes or reopens the group outcome. A new
Pick replaces the last pointer, dismissal creates none, and membership change clears it. Terminal
closure is retry-safe for an authorized current-member attendee: replaying the already-recorded outcome
succeeds without writing again, while attempting to replace `visited` with `dismissed` or vice versa
fails closed. If the response is lost, the client offers **Check outcome**, never a fresh opposite
choice and never the unsupported claim that the Pick is still open. One unnamed guest can be included in a plan without joining the group:
the guest adds one unknown to the evidence denominator and receipt count, contributes no taste,
cannot close the Pick, and creates no guest identity or profile. The development group surface also has a confirmed,
attributed pass for one exact shared draft: it previews the actor, removes the candidate only after
confirmation, and only that actor can undo. Current members watch only the final shortlist's exact
pass documents. The opaque draft identity changes with permission version, evidence timestamp,
attendees, guest count, intent, temporary area, practical need, or recent Pick; the area text itself
is never stored. At most three passes expire after six hours, successful Pick creation clears them,
and they never become permanent taste evidence. Legacy pair routes are retired
locally behind explanatory handoffs.

Card selection remains reversible and is not itself a Pick. When a person chooses a candidate, the
compact confirmation tray says **Ready for group Pick · n going**, moves keyboard focus directly to
**Make this the Pick**, and keeps **Choose another** beside it. Choosing another removes the tray and
returns focus to the exact candidate that opened it. This avoids forcing keyboard and voice-control
users through source, pass, and later-candidate controls before the explicit commitment while keeping
the trusted server revalidation as the only durable transition.

Accepting an invitation now opens the optional Quick start / Choose or find a place / Not now choice. Quick
start stores only bounded non-sensitive and practical hints, locks that exact audience, and is
covered by export/deletion; Choose or find a place first offers up to three private Keep memories and may
then use a temporary typed area or a known place, keeps one
user-confirmed Want, and explicitly projects only that reviewed place to
the group; Not now writes no taste evidence. Unfamiliar catalog retrieval and full constraint matching
remain unimplemented. Named or account-linked guest invitations
remain out of scope; the bounded guest is deliberately identity-free.

That projected Want does not become a candidate by itself. It waits for a second attendee's exact
Want/Love or matching category hint; changing it to Love may instead create the named introduction
already allowed by the recommendation contract. The client and Pick server must enforce the same gate.

## Concrete operating model

This section is the product contract for the ordinary family use case. It takes precedence over
any older language suggesting that every member must recall and enter places before a group works.

### Joining never requires homework

After accepting a group invitation, a person sees the members, the sharing boundary, and one
optional prompt: **“Help this group learn what you like.”** The choices are:

1. **Quick start** — choose a few broad place kinds and practical constraints.
2. **Choose or find a place** - review a private Keep memory, search a temporary area, name somewhere known, or share a Google Maps place into this.is.
3. **Not now** — enter the group immediately.

There is no minimum number of places and no blocked empty state. If a member has supplied no
evidence, the app says they have not weighed in. It may use other members' evidence, but it may not
count the new member as agreement.

An invitee who still needs profile setup establishes only the name and avatar required for recognizable
membership, then returns directly to the invitation consent screen. Do not ask for a private Keep seed
immediately before the group asks what the person deliberately wants to share; the same place would
otherwise become two consecutive tasks with different audiences.

The post-acceptance join screen must answer the no-recall case in plain language: a person who cannot name
a place can choose Food, Coffee, or Things to do, or share nothing yet. Each choice states whether it
closes invitations. Do not lead this moment with internal recommendation language such as “exact
signal,” “weak fit,” or “fixes the audience”; explain who sees the choice and what it changes.

Before the first Quick start hint or place becomes visible to a group, one modal review lists every
current member by name and says that confirming closes invitations. The request carries only a
normalized, exact audience stamp—current `permissionVersion` plus sorted `memberUids`—for the trusted
server to compare inside the authorized write transaction. That stamp is request state, not a second
audience record: it is never written to the URL, browser storage, Firestore, or analytics. If membership
or version changes before commit, the server returns `audience-changed` without writing the hint,
projection, group lock, or invite state. The client then fetches the group from the server and requires a
new explicit review of the newly named circle. A successful first write locks that audience and closes
outstanding invitations. Once a group is locked, ordinary repeat hint/place writes skip the modal;
removals carry no audience stamp and never reopen invitations.

Quick-start choices are weak priors, not Loves or Wants. They help retrieval while the person's real
history grows and must never produce a claim such as “Mika wants this.”

The local first version uses only non-sensitive Food, Coffee, and Activity categories. A hint cannot
invent a place: it can only admit a place another attendee explicitly shared as Want, and the visible
reason names both the exact supporter and the person whose broad hint matched. Known multi-person
support and named Loves rank ahead. Practical constraints are stored for later retrieval but are
explicitly described as future hints until candidate facts can support them. Saving Quick start
locks the shown membership audience; Not now keeps entry immediate and leaves future invites open.
Because place-kind hints can affect the current weak-fit path while those constraints cannot, the
current-value kinds lead Quick start and future-only constraints default collapsed behind an explicit
optional-for-later disclosure. The UI must not present unimplemented retrieval work as equal homework.
People can edit or remove their hints later. Removal immediately stops their influence, while the
already-fixed membership audience remains fixed because it may also protect prior exact sharing.

Quick start save and removal are exact retry-safe operations. Replaying the same normalized choices
does not rewrite the preference or lock the audience again; replaying an already-completed removal is
also a no-op. If the response is ambiguous, the reviewed choices freeze and the UI offers **Check
hint** or **Check removal** rather than a fresh mutation. It must never claim that nothing was shared,
reopen invitations, or imply that removing group hints can remove anything from personal Keep. Closing
recovery returns to the group so the authoritative fixed/open audience is visible. The development
marker may retain only the operation kind, never the person's hint choices.

### Sparse evidence asks one honest question

When the group has evidence but no eligible place, recovery must describe the exact gap rather than
repeat a generic request for more data. If another attendee has one unsupported Want and the current
member could independently supply its broad Food, Coffee, or Activity kind, the screen may name the
member and place and ask whether that kind generally sounds good. The answer is never preselected;
the place remains absent until the member deliberately shares the hint, and the resulting card names
the Want and hint separately. Declining or going back changes nothing.

A person cannot use Quick start to corroborate their own Want. Their recovery instead names their
place, explains what independent evidence would admit it, and says there is no need to upgrade an
answer merely to create a result. Tried-only sharing is described as memory rather than support.
Vetoed places and the recent Pick never become recovery targets. With exactly one eligible place, the
group hero names it in the initial phone viewport even when a larger group makes attendee controls
taller. None of these rules uses or infers location.

Separately, the active group draft may select one practical need from explicitly group-shared place
observations. That need is temporary coordination, not a stored Quick-start preference: one
attributed Yes is required, any No fails closed, and missing remains unknown. It filters eligibility
without creating taste support, changing rank, or making a safety guarantee. Draft constraints stay
local until the group confirms a Pick. The server then independently revalidates the bounded area
and need from current group evidence and stores them only on that temporary Pick, where the group can
see why the choice fit. They never become personal/group taste defaults or public receipt fields.

### One personal taste memory, many groups

A place is saved once in **Keep**, not copied into every family or friend group. The personal record
contains Want, Tried, or Loved, an optional note, and optional lightweight descriptors such as
family-friendly, quiet, casual, outdoors, or special occasion.

The local first descriptor layer is a collapsed **Useful details** editor with seven optional,
non-safety-critical Yes/No prompts. Values are reversible, timestamped, user-authored, and private by
default. Exact group sharing has an **Include my useful details** consent independent from note
consent. Only that chosen projection changes their audience to the fixed group; later edits follow
the same consent. Candidate cards preserve attributed yes/no disagreement instead of averaging it.
Provider inference, public aggregation, safety claims, and user-photo storage remain out of scope.
Each group row separates the named audience and its Shared/Not shared state from the available action.
An active projection says **Stop sharing**, never a passive **Shared with…** label that secretly removes it.
The personal place route reads only the current person's Keep memory. It does not reconstruct an
all-connections or cross-group “people who saved this” view; attributed evidence is visible only inside
the named group decision that authorized it.
If that personal save still has frozen `circle` visibility, the route leads with **Still shared outside
groups** and **Make this place private** before any exact-group or optional-note controls. This cleanup
changes only the retired visibility; explicit group projections remain separately chosen.

Exact place-to-group sharing is retry-safe and read failures stay unknown. Replaying the same canonical
place, note-consent, useful-detail consent, and permission version does not rewrite either the projection
or group document; removing an already-absent projection is also a no-op. A cold share-state read failure
must show no per-group Shared/Not shared labels and expose no mutation action. After an ambiguous share,
included-detail update, or removal, every competing group action and inclusion control freezes while the
affected row says **Share status unknown** and offers only **Check sharing**, **Check included details**,
or **Check removal** for the exact reviewed operation. The copy states that checking cannot change Keep
or another group. When Add has already saved the private Keep memory but cannot confirm delivery, it says
only that delivery is unconfirmed and hands focus to the exact authoritative group row; it never claims
the place was not shared.

A stale first-share response in Add may arrive after the personal Want/Loved memory was already saved.
That memory remains explicitly private, the UI says it is already in Keep, and no group-visible claim is
made until the person reviews and confirms the authoritative current names. For a stale included-detail
update in Closeup, the existing projection remains shared with its last confirmed details; choosing
**Keep current sharing** cancels the fresh review without removing or widening that sharing.

### Personal discovery builds Keep without creating a location profile

Keep includes a **Discover** mode for the common case where a person cannot name a place yet or wants
ideas in a different area. The person types one temporary city, neighborhood, or meeting area and then
chooses Food, Coffee, Things to do, or Drinks. Their current private Want/Loved categories order those
prompts locally; Tried remains neutral, every category stays available, and no fingerprint or area is
stored. Choosing a prompt makes one explicit, session-tokened Google autocomplete request. There is no
background search, device location, home inference, launch market, infinite feed, or popularity rank.

When Places is disabled, the same explicitly chosen kind and typed area become only the Google Maps
search query. If one exact Maps link returns to the same live Discover screen, those still-in-memory
choices may prefill the editable review; they are not saved until the person confirms the place. A cold
exact link or incoming share starts without that context and never inherits or infers a kind or area.
Resolving the exact identity does not trigger a background Place Details request.

Selecting one result opens the existing review with Google's minimal live identity context. The person
confirms the lasting label, broad category, optional place area, and Want/Tried/Loved state. Google
address/type context stays ephemeral. Photos remain on the separate budgeted saved/group surface and
are never fetched for a discovery grid. A personal result defaults to private Keep. When discovery was
opened from a named group, the private history may order prompts on-device but only the reviewed exact
Want/Loved place can be shared with that named active audience; a forming group cannot receive taste.
The canonical Keep row is forced private even if that provider identity collides with frozen legacy
`circle` visibility. Tried stays private; if the exact place was already projected to the named group,
confirming Tried removes only that projection rather than leaving stale group support. This is how
personal taste helps a family in an unfamiliar area without silently exposing the person's library.

After a personal Discover result is explicitly reviewed and its private Keep write succeeds, the live
screen may retain only that search's explicit kind and normalized temporary area in component memory.
It says **Kept privately** and offers **Find another [kind]** or **Done — view Keep**. The idle success
state makes no provider request. Find another is the single deliberate action that creates a fresh
autocomplete session for the same kind and area; the next result still requires selection, review, and
Want/Tried/Loved confirmation. Reload, route exit, sign-out, or account change discards the continuation.
It never enters a URL, browser storage, Firestore, analytics, or group discovery/share behavior. If no
explicit kind exists, Find another returns to the prompts without inferring one or starting a search.

The production-mode emulator contract uses a same-origin Places stub: it proves one autocomplete plus
one Essentials-only Details request with the same session token and proves that no verification request
can reach Google. Empty autocomplete and invalid Details responses create no save or projection. The
client also ignores prefilled URL search text until the person is signed in and any named group resolves
as active. Group-scoped Add reads only that one group envelope—not its signals or Quick Start
preferences—and waits to read private Keep until the envelope authorizes an active audience. Details
must return the exact safe requested provider ID and bounded correctly typed fields; invalid JSON,
schema, or identity mismatch cannot open review or write. The canonical private save must exist before
the explicit share request; that request can create evidence in only its named active group. Every
canonical save event—including a true create—queries only exact existing projections by indexed
`uid` + `placeId`, normally finding none and never scanning member groups. It then rereads the current
save transactionally and treats consent as belonging only to that save document's current lifetime;
a create can immediately remove stale prior-lifetime consent, while delayed events cannot transfer old
sharing into a recreated private save.
Malformed group/place document IDs and unknown share actions fail before reference lookup or mutation.
These are local cost/privacy guarantees, not production activation evidence.

The person controls two separate permissions per group:

- **Use my taste** allows a coarse derived preference fingerprint to help rank unfamiliar places.
  It does not reveal the names or notes of private saves, but the permission screen must state that
  it can reveal category-level patterns.
- **Share this place** exposes that exact signal and its bounded note to selected groups, allowing an
  exact place-level reason such as “3 of 5 want this.”

Private history therefore can improve retrieval without silently becoming group-visible history.
Revoking either permission must remove its influence on subsequent group results.

The first fingerprint excludes sensitive categories by default, including alcohol/nightlife,
religiously marked venues, health/recovery contexts, and adult venues. A member opts those categories
in separately per group. A group-level taste-fit reason requires independent support from at least
two attendees; one person's private fingerprint may retrieve a candidate but may not produce a
visible “your group likes…” explanation.

### Known matches and unfamiliar suggestions are different evidence

The engine has two modes and the interface must label them differently:

1. **Known match** — at least two members shared Want/Loved evidence for the exact place, or one
   member shared a Love as a named introduction. The existing support/veto contract applies.
2. **Taste-fit suggestion** — nobody has saved the exact place, but its type and user-supplied
   descriptors fit the group's permitted coarse taste fingerprint. The reason says that it is new
   and names the actual pattern, for example: “New to this group · fits your casual coffee pattern.”

A predicted fit is never described as agreement. One plan-level **Not for us** removes it from that
plan and is visibly attributed after confirmation; **Not my taste** is a private learning signal and
is not shown to the group or allowed to remove a shared candidate. Either kind may
appear within the same three-candidate limit, but known matches lead when they fit the plan.

An attributed draft pass is an exact desired-state operation for one opaque reviewed draft identity.
The client sends that identity back to the server; if membership, evidence, attendees, guest count,
intent, area, practical need, or recent Pick changed, the older action is rejected rather than applied
to the new answer. An identical pass and an already-completed undo are no-op successes. After an
ambiguous response, every attendee, plan, candidate, Pick, undo, and leave control freezes while one
focused **Check pass** or **Check undo** repeats only the reviewed operation. The interface never claims
that nothing changed and checking can never alter personal Keep.

### Adaptation belongs to people, not location profiles

this.is does not maintain a home area, target people by device location, or silently rank from inferred
geography. The shortlist adapts when the attendee subset, their explicitly permitted evidence, their
outcomes, or the current Food/Drinks/Coffee intent changes. A place's neighborhood may appear as a
factual label, but geography is not treated as taste.

If a person explicitly supplies meeting geography while coordinating, it is temporary logistics for
that draft only. The implemented known-place filter compares bounded Unicode-aware typed words only
with areas members explicitly confirmed on places; missing area stays unknown. The draft text is not
saved to a person, group, Pick, event, or fingerprint, reused as a default, geocoded, or described as
personalization. Google Maps remains the routing handoff after the group chooses.

Unfamiliar-area resolution must require an explicit named selection from the global server-owned
gazetteer. Its query endpoint is authenticated to a current active-group member, globally text-ranked,
capped at five results, and disabled unless a reviewed digest-pinned artifact matches the remote
operator configuration. It may record one aggregate request count, but never query text, coordinates,
gazetteer ids, group ids, or user ids. Having this fail-closed server boundary does not authorize an
unfamiliar-place UI or imply that a reviewed global artifact is deployed.

The adaptive pipeline is:

```text
family chooses actual attendees + dinner
→ gather their current, explicitly permitted place evidence
→ apply current group vetoes
→ compare types/descriptors with each attendee's permitted taste fingerprint
→ merge exact shared evidence where it exists
→ show at most three, each labeled known match or new taste-fit
→ group selects one and Google Maps handles routing
```

The first version of adaptive inference is deliberately simple: primary place type, explicit
descriptors, Want/Loved strength, attendee breadth, and current intent. It must not claim to infer ambience,
quality, dietary safety, accessibility, or price unless that data was explicitly supplied or an
approved field was retrieved. Machine learning is unnecessary until real decisions show these
deterministic features are insufficient.

### What Google does and does not know

Google Places supplies explicit search/capture, a stable Place ID, approved place facts, one live
image where budget allows, and the outbound Maps handoff. It does
not provide this.is with the person's Google Maps saves, ratings, or Timeline.
Capture does not infer the person's broad place kind from the provider result or silently default it
to Other. Food, Drinks, Coffee, Activity, or Other becomes durable only after an explicit choice.
Want, Tried, or Loved likewise begins unknown during new capture; the person must explicitly choose
the experience before any personal save or group projection can be written. A user-typed place area
remains an optional collapsed detail after that experience choice; in group-scoped capture, the exact
named audience appears before it. Cancel writes neither the personal save nor the group projection.

Google says Timeline data is device-based, opt-in, and unavailable on desktop. There is no approved
Places API that gives a third-party app a person's visit history. Therefore this.is must not promise
automatic Google-history learning. A future user-initiated import may accept an explicit export if
Google's terms and available formats support it, but it cannot be an onboarding dependency.

### The minimum useful journey

1. Join the family group and skip setup if desired.
2. Over time, save places in Keep from search, a recommendation, or the phone's share sheet.
3. Choose which groups may use coarse taste and which exact places they may see.
4. When planning, set only what changed: actual attendees plus optional Food/Drinks/Coffee and
   practical constraints. No location setup is required.
5. Receive no more than three options with evidence-accurate reasons.
6. Select one, open it in Google Maps, then optionally close the loop as Tried, Loved, or Not for us.

The final commitment is one reviewed intention, not one HTTP attempt. One opaque client operation key
must identify the exact group, creator, attendee set, place, context, optional guest, area, and useful
need. If the response is lost after commit, an exact replay returns the same Pick and public receipt;
the same key can never change that decision, and a different key cannot create a second open Pick.

This is a progressive system: it is usable with zero history, becomes more personal with private
taste memory, and becomes more certain as exact place-level group evidence accumulates.

“Usable with zero history” is not accepted as a launch win. Phase B validation must compare a fully
cold first plan against the group's ordinary method (Maps, chat, or an assistant), then measure
whether that experience earns a second plan. If the cold plan is consistently worse, this.is must
enter through existing histories and recurring groups rather than pretending to be a general Maps
replacement.

The final Pick produces an unfurlable, no-install link/card designed to return to the existing group
chat. The chat remains where coordination lives; this.is supplies the durable evidence receipt. The
public card contains only place name, broad type/area when present, server-derived reason, context,
attendee count, status, and a Maps link. It never contains group/member identity, notes, or underlying
signals. Links expire after 30 days, are directly revocable by a current member, disappear when a Pick
is dismissed, and are all revoked on any membership change. Direct Firestore reads are denied; a
server-rendered allowlist produces the Open Graph and HTML response. Revocation is retry-safe after an
ambiguous response: once a current member has removed the token, another authorized exact request is a
no-op success and cannot restore the link or decrement receipt accounting twice. Until confirmed, the
private screen withholds the uncertain link from sharing and offers only **Check link**; it never claims
the link still works.

On the private committed-Pick screen, the current action order follows time: Google Maps first, the
optional chat receipt second, and shared closure last. **After the outing** is collapsed on arrival so
`We went / Not for us` cannot compete with routing or invite an early terminal action; opening it
reveals the existing lifecycle controls without changing their semantics. This also returns the first
line of real member evidence to the initial 390×844 viewport.

## Image and cost contract

The interface may use Google Places photos, but beauty cannot depend on an unbounded photo grid.

- Prefer a user-owned photo when available, then one live Google photo, then the designed amber
  material/poster fallback.
- Group decision surfaces show at most one photo for each of at most three candidates. No automatic
  carousel, background prefetch, or off-screen photo load.
- Fetch a current photo resource name only when the card is about to become visible; Google says
  photo names can expire and may not be cached. Render required author attribution beside the image.
- Keep strict field masks. Do not add ratings, reviews, hours, price, atmosphere, accessibility, or
  other paid fields without a named feature, cost estimate, and approval.
- Cache our own derived group fingerprint and user-owned content. Treat Google place snapshots only
  under the approved refresh/retention policy; Place IDs remain the durable identity.

The browser `photoBudget.ts` guard remains a per-device runaway-rendering safety valve. Final-three
group candidates and explicit saved-place closeups are mediated by one authenticated server proxy
that accepts only current group evidence or the caller's canonical save,
keeps the Google key server-side, and transactionally reserves an identity-free UTC-month project
counter. It fails closed when operator configuration is missing, disabled, malformed, or exhausted.
Before public group use, reviewed deployment evidence must confirm:

- a monthly project allowance below Google's free cap;
- a small per-device daily guard for runaway rendering;
- the implemented remotely controlled photo kill switch;
- billing alerts and usage telemetry by SKU;
- poster/material fallbacks that preserve layout when the allowance is exhausted.

As of July 11, 2026, Google lists 1,000 free monthly events and then $7 per 1,000 for the photo-tier
Places SKU, while Nearby Search Pro and Text Search Pro have 5,000 free monthly events and then $32
per 1,000. Pricing is pay-as-you-go and may change, so these are monitoring inputs rather than
hard-coded product assumptions. See [`../../v2/docs/GOOGLE.md`](../../v2/docs/GOOGLE.md) for the
maintained technical ruling.

The local dark implementation now provides the server boundary: `/placePhoto` authenticates the
caller, proves the canonical Place ID belongs either to current-version evidence in that caller's
active group or to the caller's own canonical save,
reserves one identity-free UTC-month slot transactionally, and returns uncached media with a validated
Google Maps photo source. Missing or malformed `serviceConfig/placePhotos` disables it; configuration
cannot exceed 999 monthly events. The client additionally requires `VITE_GROUP_PHOTOS_ENABLED=true`
and retains its six-place daily device guard. Keep/search grids never request Google media, and the
browser no longer constructs media URLs with its public Places key. Both controls remain off for ordinary builds. This code
is not operational approval: the server secret, Google API quota/key restrictions, billing alerts,
SKU telemetry, and cutover evidence must all be real before activation.

## Privacy architecture before production

Do not stretch the current all-connections `circle` visibility into groups. That would make a place
shared with one group readable by unrelated connections.

Preserve one canonical personal signal and add a server-owned derived group projection:

```text
saves/{uid}__{placeId}                       canonical personal truth
groups/{groupId}                             2–6 members + status
groups/{groupId}/signals/{uid}__{placeId}    bounded server-derived read model
```

- The owner chooses which groups receive a signal.
- A trusted backend verifies ownership and active membership before materializing it.
- Clients never write projections directly.
- Rules read a projection only when the requester is in the current group document.
- Removing a member or closing a group denies that person's reads immediately through membership.
  The same transaction increments a permission version and revokes the departing member's projected
  signals, so remaining members also lose access to the leaver's evidence immediately. Cached plans
  and fingerprints must fail closed when their permission version is stale.
- Leaving is an idempotent **ensure I am no longer a member** operation. An exact retry after the
  caller has already left succeeds without changing membership again, deleting another person's
  projection, or repeating group cleanup. A caller who was never a member receives the same bounded
  no-op result and cannot use it to mutate or enumerate a group.
- If the client cannot confirm the leave response, it must offer **Check membership**, explain that
  checking can only finish leaving and cannot rejoin the person or remove personal Keep, and never
  claim that membership is unchanged. Personal Keep is outside the group cleanup boundary.
- Updating/deleting the canonical signal updates/deletes its projections.
- Retiring frozen connection-circle visibility is an exact desired-state operation. Identical retry
  after a lost response must perform no second write. Until the client confirms the result, it calls
  the state unknown, offers **Check privacy**, and pauses taste, memory, note, projection, and deletion
  actions that could move the save underneath that check. The check cannot remove Keep or a group
  projection.
- Every personal Keep mutation follows the same response-truth law. An identical tag, place-memory,
  note, useful-detail, or deletion retry is a no-op and cannot refresh taste evidence. A lost response
  preserves the last confirmed visible state plus the exact attempted value, focuses one **Check**
  action, and freezes competing writes. New capture confirms private Keep before starting any separate
  group share; deletion names that its existing projections follow the canonical removal. Toast and
  onboarding mutations retain the same boundary instead of degrading to a fresh “try again.”
- Group-visible identity follows that law too. Name and avatar writes compare the exact desired fields;
  onboarding completion preserves its first completion timestamp. A lost Settings response keeps the
  last confirmed profile visible, names the exact attempted change, focuses **Check profile**, and
  freezes both identity controls until exact retry confirms it. A lost onboarding response similarly
  retains the exact reviewed identity and completion attempt, focuses **Check setup**, and freezes
  competing identity, Keep, group-join, and sharing actions until exact retry confirms it. These checks
  cannot change group membership or Keep.
- Account deletion is one opaque exact operation, retained by the initiating browser until confirmed.
  The server stores only its SHA-256 identifier. While cleanup is active it may temporarily bind that
  operation to the deleting UID; after canonical cleanup and Auth removal it replaces the UID with an
  identity-free completion tombstone that expires after seven days. Possession of the random operation
  key can only finish or confirm that same deletion. After an ambiguous response the UI says the
  account is locked and may already be gone, offers **Check deletion**, and never offers **Keep my
  account** as though the irreversible lock could still be canceled.
- Notes follow the selected-group audience and state it before save.
- A pair migrates into one deterministic two-member group; do not retain separate pair and group
  authorization systems indefinitely. Exact replay returns that same group without rewriting the
  audience, projections, Picks, or migration marker. After an ambiguous response, the affected row
  becomes **Check group**, competing migrations freeze, and the copy says checking cannot add people
  or move private places or notes. It never claims nothing changed.

This derived read model exists only to solve the authorization/query boundary. It is not a second
source of taste truth.

## Production sequence

1. Use the production-shaped pair flow as Phase A evidence for accumulated taste, consent, and Picks;
   it cannot approve group production.
2. Specify attendees, membership, invitations, audience selection, attributed vetoes, projection
   lifecycle, sensitive fingerprint categories, and complete derived-data erasure.
3. Implement rules and emulator tests before exposing a production group route.
4. Build plan-scoped server retrieval; the shareable Pick receipt is implemented locally and awaits
   reviewed deployment plus real chat-client unfurl validation.
5. Migrate pair connections to two-member groups without changing confirmed signals.
6. Extend Picks and privacy-minimal analytics to `groupId`, attendee subsets, and 2–6 members.
7. Run Phase B from [`GROUP_VALIDATION_PLAN.md`](GROUP_VALIDATION_PLAN.md); only it can approve the
   group-native thesis for production.

## Visual ruling

The approved baseline combines deep smoked glass, restrained post-rain atmosphere, parchment reading
planes, oxblood/coral actions, and **localized** dark amber refraction. Amber is a signature field,
not glowing trim. No sparkles, celestial ornaments, fantasy glow, candy glass, or dense rain overlay.

The code prototype reconstructs the material with CSS gradients, grain, hairlines, and bounded blur;
the generated image is reference only.

Browser evidence:

- [`group-index-amber-390.png`](../../output/playwright/group-index-amber-390.png)
- [`group-recommendations-amber-390.png`](../../output/playwright/group-recommendations-amber-390.png)
- [`group-selected-amber-320.png`](../../output/playwright/group-selected-amber-320.png)
- [`group-coffee-amber-768.png`](../../output/playwright/group-coffee-amber-768.png)
