# Place memory migration

**Status:** local client, persistence, rules, group, Pick, receipt, and read-only migration cutover implemented; production data remains untouched.  
**Decision:** durable taste belongs to the user; Google facts are live or expire.

## Why a timestamp is insufficient

The legacy `saves.place` object copied a Google-derived name, type, neighborhood, coordinates, and
color into a document that lasted as long as the user's signal. Group projections, Picks, receipts,
and exports then copied parts of that snapshot again. Hiding coordinates after 30 days is not
deletion, and deleting the whole signal would destroy truthful Want/Tried/Loved history.

## Durable user-authored memory

```text
placeId       opaque Google ID or owned/open catalog ID
label         words the person explicitly typed or edited and confirmed
category      Food / Drinks / Coffee / Activity / Other chosen by the person
area          optional short place area typed and confirmed by the person
hex           deterministic this.is color derived from that category
provenance    user_confirmed
```

This object may be copied into a group projection or Pick because it is the person's own meaning,
not rehosted Google Maps content. The opaque Google Place ID remains storable indefinitely under
Google's documented exception.

## Live Google context

If Google facts are ever persisted, they must live in a distinct cache surface with enforced TTL
and must never be copied into signals, projections, Picks, receipts, analytics, or owned/open facts.
The current implementation takes the smaller path: Google responses live only in the in-memory
query cache and are never written to Firestore. UI can display that live response with adjacent
Google Maps attribution; honest absence returns when the session ends or the live request fails.

## Capture UX

1. A person types a global query and chooses an autocomplete result.
2. The existing Essentials Details call closes the billing session; returned Google facts remain
   transient.
3. Before the signal is committed, this.is asks for a short personal label, one broad category, and
   an optional place area. The area is typed by the person, is never prefilled from Google's address,
   and never becomes a home or user/group location profile.
   For typed search, the label may start from the person's exact query. For a pasted Maps link it
   starts empty. A Google display name may be shown as attributed transient context, but is never
   silently adopted as durable user content.
4. One confirmation writes the durable memory plus Want/Tried/Loved. A later focused editor can
   correct label, category, or area without changing the taste status/timestamp, note, observations,
   visibility, or explicit group-sharing consent. Existing selected projections follow the correction.

## Existing data

The migration planner may preserve the opaque `placeId`, tag, visibility, note, and timestamps. It
must not copy a legacy Google-derived name/type/location into the new durable shape. Each retained
place needs explicit label/category confirmation. Until confirmed, the signal remains visible to its
owner as unresolved history and cannot become new group recommendation evidence.

Keep shows unresolved legacy saves as anonymous cleanup tasks. Closeup allows a personal label and
category even when live Google details are unavailable. The read-only v1 planner emits a write only
when a separate `confirmedMemoriesByPlaceId` input is present; otherwise it reports
`needs_user_confirmation` without copying the provider name into its output.

## Verification state

1. Domain contract and non-inference tests — implemented.
2. Add, Onboarding, and Closeup confirmation plus the new save schema — implemented locally.
3. Server projection, recommendation, Pick, and receipt no-copy boundary — implemented locally.
4. Rules deny new durable Google snapshot fields; no persistent Google cache exists — implemented locally.
5. Read-only migration planning reports confirmed/unresolved outcomes — implemented locally.
6. Rules, Functions, group lifecycle, and account-data emulator coverage — implemented locally.
7. The structural Google snapshot blocker is clear. Production cleanup, reviewed legal identity,
   project-wide photo allowance, and real-group pilot evidence remain separate cutover blockers.
