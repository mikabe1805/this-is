# v1 → canonical v2 data migration

**Status:** read-only planning and production-shaped invariants are implemented. No production data has been read or written by this reset.

## Scope

The only v1 behavior worth migrating is a person's explicit place signal:

```text
person × Google Place × Want | Tried | Loved × optional note
```

Boards, list names, public status, likes, rankings, posts, activity, influence, trips, vibe seeds, and feed state do not enter the canonical model.

## Source reality

v1 does not have one reliable save record:

- `users/{uid}/savedPlaces/{place}` is frequently only an id/timestamp marker.
- `lists/{list}/places/{place}` usually holds the explicit status, note, and added time.
- auto-status lists (`autoStatus` or “All Want/Tried/Loved”) can recover a missing row status.
- `places/{legacyId}` may use an internal id; only `googlePlaceId`, a `g:` id, or a Google `ChIJ…` document id can establish canonical identity without guessing.

## Transformation laws

1. A row with explicit Want/Tried/Loved beats an inferred auto-list status.
2. Among explicit duplicates, the newest timestamp wins.
3. Exact ties resolve deterministically, independent of query/list order.
4. A marker without recoverable sentiment is reported as `unknown_status`; it is never converted to Want or Loved by assumption.
5. An internal place without a Google identity is reported as `unresolved_google_place_id`; name matching and paid Details calls are not performed automatically.
6. The target save id is deterministic: `{uid}__g:{googlePlaceId}`.
7. An existing v2 signal is never overwritten.
8. An existing canonical place snapshot is preserved, not merged with legacy facts.
9. Only missing place snapshots are planned for creation.
10. The rollback manifest lists only documents that the plan would create.
11. Migrated signals default to `private`; circle visibility requires the explicit `--visibility circle` review choice.

## Read-only dry run

With Firebase Admin application-default credentials:

```bash
npm run migration:plan -- --uid FIREBASE_UID
```

This prints aggregate counts only. To write a review artifact:

```bash
npm run migration:plan -- --uid FIREBASE_UID --out private-migration-plan.json
```

The plan can contain private notes. The output uses create-only semantics and refuses to overwrite an existing file. Store it securely and delete it after review.

No `--apply` mode exists. Production mutation requires a separate reviewed executor that verifies the plan hash, records created document paths, uses bounded batches, stops on drift, and applies the generated rollback manifest if validation fails.

The default plan keeps every migrated place and note private. Only use `--visibility circle` after the account owner has explicitly agreed that all planned signals may shape recommendations with their connections.

## Offline verification

```bash
npm run migration:plan -- --fixture v2/tests/fixtures/legacy-migration.json
npm --prefix v2 run test:migration
```

The fixture covers explicit list status, auto-list inference, duplicate resolution, unknown status, unresolved identity, existing v2 protection, existing place preservation, rollback paths, repeat-run idempotency, and order-independent ties.

## Approval evidence required before an executor exists

- Dry-run summary for each intended pilot account.
- Manual review of every skipped unknown-status or unresolved-identity row.
- Confirmation that no existing v2 signal would be overwritten.
- Counts reconciled against visible v1 lists and saved-place markers.
- Secure location and deletion date for sensitive plan artifacts.
- Named approver for apply and rollback.

## Pair-to-group retirement contract

The separate `connections` relationship must not survive as a permanent second product model. The
write-free backend invariant now lives in `v2-functions/src/pair-migration.ts`:

- one active accepted pair becomes one deterministic two-member group;
- the audience is exactly the same two UIDs—never expanded;
- current circle-visible signals may narrow into that group's projections;
- private signals, unrelated members, and notes never migrate automatically;
- the newest explicit signal wins per person/place, the 300-projection bound remains enforced, and
  carried evidence locks membership immediately;
- retries resolve to the same opaque group ID.

The trusted conversion endpoint now performs transaction-level drift checks, converts historical
Picks, exposes an explicit UI handoff, and passes Auth/Firestore/Functions emulator proof. Pair
product routes are removed from the build; old URLs provide only an explanatory retirement handoff.
