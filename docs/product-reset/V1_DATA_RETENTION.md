# Frozen v1 data retention and erasure decision

**Status:** recommended policy and read-only inventory planner are implemented; owner approval and production dry-runs are still required. Nothing in this document authorizes deletion or deployment.  
**Applies to:** the retired root v1 Firestore and Storage surfaces. Canonical v2 rights remain defined in [`DATA_RIGHTS.md`](DATA_RIGHTS.md).  
**Not legal advice:** this is a conservative product and engineering policy for a private-pilot product.

## Decision

Retire v1 as a product and retain no identifiable v1 data merely because the old schema exists. Migrate only an owner's explicit Want / Tried / Loved place signals through the separate, opt-in, private-by-default process in [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md). Do not migrate feeds, influence, rankings, public profiles, messages, posts, likes, activity, analytics, or list structure into v2.

When an authenticated owner requests whole-account deletion, the target behavior is:

1. Offer a machine-readable export before deletion. Export owner-authored records; do not duplicate another person's private profile or message content merely because it appears in a shared record.
2. Lock new writes before cleanup, using the canonical v2 deletion marker.
3. Delete v2 through the implemented server operation.
4. Delete the owner's retired v1 data and scrub their identity from shared facts according to the matrix below.
5. Delete Firebase Authentication last, after both schemas and Storage have been reconciled.
6. Record only a non-identifying completion receipt. Do not keep a reusable UID tombstone unless abuse prevention or a documented legal obligation makes it necessary.

This recommendation follows a minimization posture: GDPR Article 5 limits data to what is necessary and Article 17 establishes erasure grounds; Article 20 says portability must not adversely affect other people's rights. California's Attorney General describes deletion as covering information collected from the consumer and service providers, subject to exceptions. The FTC likewise recommends retaining personal data only for an essential period rather than indefinitely.

## Legacy surface matrix

| Surface | Owner relationship | Recommended erasure action |
|---|---|---|
| `users/{uid}` and all descendants | Direct profile, graph, saves, comments, activity, old boards/pins | Recursive delete |
| `userPreferences`, `userTaste`, `userRankings` | Direct and derived personal state | Delete owner document |
| `posts`, `lists`, `hubs` authored by UID | Owner-created retired content | Recursive delete; delete linked Storage objects |
| Authored comments and list-place notes | Owner-created content inside another record | Delete the authored document |
| `threads` containing UID and all messages | Intimate shared content in a retired feature | Delete the complete retired thread; do not strand a UID or preserve message text without purpose |
| Flat `saves` and `places/*/saves/{uid}` | Explicit owner signals and counters | Delete; reconcile denormalized counts |
| Analytics events containing UID | Identifiable behavioral history | Delete |
| Follow/friend documents and profile arrays elsewhere | Cross-user identity references | Delete relation documents; remove UID from arrays |
| `likedBy` arrays and counts | Shared aggregate reference | Remove UID and recompute the count from the resulting array |
| Embedded post copies on place documents | Denormalized owner content | Remove only the owner's embedded copies |
| Published `shares` containing UID | Public or link-accessible identity copy | Delete snapshot |
| Firebase Storage URLs reachable only from deleted owner content | Uploaded personal media | Delete exact objects after references are inventoried |
| Global Google place facts, curated facts, and expired caches | Not owner-authored personal state unless they embed user content | Keep only after personal fields and embedded posts are removed |
| Any exact UID reference not covered above | Unknown schema drift | Stop and require manual review |

The complete-thread recommendation is intentionally specific to the retired v1 messaging feature. It avoids retaining both participants' intimate content in an inactive system. If v1 messaging must remain available to another participant, replace this rule before implementation with a reviewed redaction design that removes authored text, UID-bearing paths, participant metadata, read receipts, previews, and Storage attachments without misattributing the remaining conversation.

## Retention schedule

- **Active canonical data:** retain while the account exists and the record serves the declared product purpose.
- **Privacy-minimal canonical events:** raw events expire after 30 days. Rules bound the expiry, the deploy manifest enables TTL, and aggregate summaries stop counting an event at expiry even if asynchronous deletion has not completed.
- **Frozen v1 data:** retain only through the reviewed migration/export window. Recommended maximum: 30 days after the owner's successful cutover, then erase.
- **Sensitive plan/export files:** owner-controlled, encrypted location only; set a deletion date at creation and remove after reconciliation.
- **Backups, if enabled:** document their actual expiry. Recommended maximum is 30 days, with deleted accounts suppressed from ordinary restore and re-erased before any restored system becomes available.
- **Legal/security holds:** exception only when documented with scope, authority, owner, and expiry. Do not silently turn a hypothetical exception into indefinite retention.

The 30-day values are product recommendations, not claims about current Firebase backup configuration. Production cutover remains blocked until actual backup, log, analytics, Storage, and processor retention settings are inspected.

## Read-only erasure planner

Run with Firebase Admin application-default credentials:

```bash
npm run erasure:plan -- --uid FIREBASE_UID
```

The default output contains aggregate counts only. For a private path-level review artifact:

```bash
npm run erasure:plan -- --uid FIREBASE_UID --out private-erasure-plan.json
```

The output file is create-only and can contain sensitive paths and Storage URLs. Store it securely and delete it after review. The planner performs reads only; it has no apply mode.

Before any executor exists, reconcile every `manual_review` action, verify Storage objects, export the owner data, identify backup/log retention, name an approver, hash the reviewed plan, and rehearse rollback for patches to shared documents. Destructive execution belongs in an authenticated server operation, never in the frozen client-side `deleteUser()` method.

## Sources

- [EU GDPR, Articles 5, 17, 19, and 20 (EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [California Attorney General: CCPA rights and deletion exceptions](https://oag.ca.gov/privacy/ccpa)
- [FTC: retain personal data only for an essential period](https://www.ftc.gov/business-guidance/resources/careful-connections-keeping-internet-things-secure)
- [Firebase: delete Firestore data and subcollections](https://firebase.google.com/docs/firestore/manage-data/delete-data)
- [Firebase: delete authenticated users and recent-login requirement](https://firebase.google.com/docs/auth/web/manage-users)
