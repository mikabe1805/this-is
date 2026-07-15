# Canonical data export and deletion contract

**Status:** implemented locally for the canonical v2 schema; undeployed.  
**Purpose:** make owner control testable without claiming that the frozen v1 deployment has already been retired or that this document is legal advice.

> **Group amendment, July 12:** export and deletion now cover accepted group documents and the
> owner's implemented invitations and signal projections. Account deletion removes those artifacts,
> increments a surviving 3–6 person group's permission version, and closes a two-person group.
> Group invitations, group Picks, six-hour attributed draft passes, and privacy-redacted public receipts are now covered by the same
> export/deletion proof. Bounded group Quick start preferences are also exported, removed with their
> owner, and permission-version repaired for surviving members. Production groups remain blocked until fingerprints, adaptive candidate caches, and every other
> implemented derived artifact receive equivalent coverage.

## Required derived-data coverage before groups

Every new group artifact must name its owner, export treatment, erasure trigger, audience-revocation
behavior, and maximum retention before its schema is accepted:

| Artifact | Export | Required erasure/revocation behavior |
|---|---|---|
| group signal projection | disclose with canonical source/audience | canonical save deletion, audience removal, membership departure, account deletion |
| per-group taste fingerprint | disclose categories, inputs class, updated time | permission change, membership departure, account deletion; stale permission version fails closed |
| quick-start priors | disclose exact choices and group audience | user edit/delete, group departure, account deletion |
| private `Not my taste` feedback | disclose exact private outcomes | user delete and account deletion; never exported to another member |
| plan veto/pass | disclose action and promised attribution | six-hour plan expiry plus account deletion; permission/evidence/draft change fails closed and it never survives as a global taste judgment |
| plan retrieval/cache | disclose only if it contains personal constraints | plan expiry, group closure, permission-version change |
| public Pick receipt | disclose token and exact redacted payload | 30-day expiry, member revocation, dismissal, any membership change, group closure, account deletion |
| migrated pair marker | disclose original two-member relationship and target group ID | account deletion; never grants legacy save visibility after migration |
| similarity/taste-neighbor edge | do not persist before a reviewed need | if ever stored, disclose both provenance and score basis; either endpoint deletion invalidates it |
| owned observations/photos | disclose content, audience, provenance | author delete, audience removal, account deletion, Storage deletion |
| aggregate photo allowance | not personal and not exported: UTC month, total count, configured ceiling only | operator rotation/deletion; must never add UID, group ID, Place ID, or request history |

`verify:data-rights` must add a real artifact of every implemented class and prove it is absent after
deletion. A generic promise to “clean up derived data” does not satisfy this gate.

## Export scope

`POST /exportMyData` requires a verified, non-revoked Firebase ID token and returns one portable JSON document containing:

- Firebase account metadata: UID, email, display name, photo URL, creation/last-sign-in time, and provider names;
- `users/{uid}` profile data;
- every owner-authored `saves` signal, including private notes, structured observations, and visibility;
- every `connection` and `pick` where the UID is a member;
- every accepted `group` where the UID is a member and every group signal projection derived from
  that owner's canonical signal, plus the owner's exact per-group Quick start choices and attributed
  draft passes;
- every pair or group invitation created by the owner, plus group invitations the owner accepted;
- each still-live redacted public receipt referenced by an exported group Pick;
- the owner’s write-only product events.

Firestore timestamp-like values become ISO dates. The response is private, non-cacheable, and downloaded locally by Settings. Retired Google-seeded city pools are denied and are not an accepted data surface. Future owned/open catalog facts are not duplicated into the export unless a user's authorship, private observation, or audience choice makes the record personal.

## Deletion scope

The first `POST /deleteMyAccount` for an operation requires all four:

1. a verified, non-revoked Firebase ID token;
2. authentication within the previous five minutes;
3. the exact confirmation value `DELETE`;
4. a browser-generated 256-bit operation key scoped to that exact account UID.

Deletion is idempotent until the Auth user is removed. The server first marks `users/{uid}` as deleting. Firestore rules then reject new profile, event, save, invitation, connection, or Pick writes from that identity while cleanup is running.

The operation then removes:

- all owner-authored saves, notes, and structured observations;
- pair and group invitations created by the owner, plus accepted group invitations naming the owner;
- connections and Picks containing the owner, because their two-person schemas cannot truthfully survive with one member;
- the owner's group signal projections, Quick start preference, and attributed draft passes; group membership is removed and its permission version is
  incremented immediately, every public receipt for that group is revoked, and a two-person group is
  closed rather than retained with one member;
- retained legacy `following` references to the UID on other profiles;
- the profile document and all descendants, including the otherwise-unreadable events subcollection;
- the Firebase Authentication user, last.

Deleting Auth last means a partial Firestore failure leaves an authenticated owner able to retry the server operation, while the deletion marker prevents new writes from racing the cleanup. Deleting a parent document alone is insufficient because Firestore does not automatically delete subcollections.

The browser keeps a stable retry key under the exact account UID and remounts the destructive UI when that UID changes. It discards the older unscoped browser key because its owner cannot be established, and clears only the matching UID-and-key entry after confirmed success. The client checks Firebase Auth both around token retrieval and again before clearing shared caches or signing out, so a late response from one account cannot act on a replacement account in the same tab.

The key is also the bounded recovery capability after cleanup has removed or invalidated the owner's Auth token. An unauthenticated request with that exact key may finish an already `cleanup-complete` operation or receive a no-op success from its identity-free `complete` tombstone. Once the tombstone is `complete`, its removed UID means no authenticated caller can be safely associated with it, so every authenticated replay receives a `409` rejection; the key cannot claim, delete, sign out, or clear data for another account.

## Explicit boundary

This contract covers the canonical v2 collections. The frozen v1 system also contains historical top-level posts, lists, threads/messages, analytics, Storage objects, denormalized copies, and cross-user references. [`V1_DATA_RETENTION.md`](V1_DATA_RETENTION.md) now records the recommended retirement/erasure policy and the read-only account planner, but production dry-runs and owner approval remain outstanding. The v2 UI therefore still says exactly that it deletes the **v2** account data; it does not make a broader legacy-erasure claim.

## Verification

`npm run verify:data-rights` starts isolated Auth, Firestore, and Functions emulators and proves:

- anonymous export is denied;
- the owner export covers every canonical personal-data surface and emits portable timestamps;
- deletion removes Auth, profile descendants, signals, invitations, connections, group membership,
  owner projections and Quick start preferences, Picks, public receipts, events, and legacy follow references; surviving hints receive the new permission version;
- an unauthenticated exact-key replay remains a no-op success after Auth removal and does not rewrite the completion tombstone;
- a second authenticated account cannot reuse that completed key, and both its Auth user and exact Firestore bytes remain unchanged.

The Firestore authorization suite separately proves bounded profile writes, denial of client-driven profile deletion/deletion markers, and write lockout after the server marker appears.

## Sources

- [Firebase: manage and delete authenticated users](https://firebase.google.com/docs/auth/web/manage-users)
- [Firebase: verify ID tokens on a trusted server](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase: delete Firestore documents and collections](https://firebase.google.com/docs/firestore/manage-data/delete-data)
