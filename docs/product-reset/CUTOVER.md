# this.is — canonical cutover contract

**Status:** v2 is canonical for local product work. Production remains on the legacy deployment until every gate below is evidenced and reviewed.

## Why this exists

The repository historically allowed four different authorities to disagree: root source, in-repo v2, a separate clean-room v2 folder, and the live Firebase project. A successful build was therefore not proof that the intended product would be served. This contract makes authority and rollback explicit.

## Current version map

| Asset | Authority | Action |
|---|---|---|
| `v2/src`, `v2/firestore.rules`, `v2/README.md` | Canonical implementation | Continue |
| Root `src`, root functions, root Firebase rules | Live legacy system | Freeze; migrate deliberately |
| `C:\Users\mikus\this-is-v2` | Superseded experiment | Archive manually after confirming no unique assets remain |
| `docs/product-reset` | Canonical decision record | Keep synchronized with evidence |

## Cutover gates

### Family dogfood is a separate backend, not a production shortcut

Personal use with the owner's family may continue without the external-research readiness card, but
it must not use the live legacy Firebase project. Canonical local development is emulator-only. A
real-phone family alpha requires a new empty Firebase project, approved family accounts, an
origin/API-restricted Places browser key, photos disabled, and no production read, migration, or
copied account data. Copy `.env.family-alpha.example` to the ignored
`.env.family-alpha.local`; then `npm run family-alpha:check` and `npm run family-alpha:build` fail
closed on malformed, unknown, duplicate, missing, or placeholder dedicated keys; the legacy/demo
projects; mismatched project/Auth/bucket/sender/app values; Firebase/Places key reuse; tracked legacy
browser-key reuse; ambient overrides (including `.env.local` and the disabled Vite prefix); emulator
or stub mode; or photos. Diagnostics report key names without echoing credential values.

The build validates the exact reviewed backend surface, generates ignored Firestore rules that
strengthen only `signedIn()` with `request.auth.token.familyAlpha == true`, and generates an ignored
Functions package whose shared authenticated-identity boundary requires the same decoded-token
claim. That package exposes exactly 19 reviewed Functions and physically omits `placePhoto`, its
`PLACES_SERVER_KEY` secret, and `migratePairToGroup`. `firebase.family-alpha.json` points only to
those generated backend artifacts and serves ignored `v2/.family-alpha-dist`, never canonical
`v2/dist`. The app build ends with a verifier for the marked emitted shell, exact public config,
precache ownership, source-map absence, and legacy/photo-path leakage. These transformations fail on
canonical drift and perform no network request, claim provisioning, or deployment.

The repository intentionally has no family-alpha deploy command yet. Creating that external project,
rotating/restricting any browser-key material retained in legacy Git history, reviewing billing/quota
alerts, enabling only the intended sign-in provider, and granting `familyAlpha: true` to each reviewed
family account through a separate admin-only procedure are owner actions. An authenticated but
unclaimed account is denied by Firestore and authenticated HTTP paths; the repository does not yet
provision or revoke claims. When a first deployment is separately authorized, deploy generated rules
and indexes to the explicit alpha project first, wait for `signals(uid, placeId)` to report **READY**,
and only then deploy the generated Functions surface and Hosting to that same explicit project. Never
rely on an implicit Firebase target: `.firebaserc` deliberately has no `default` project and retains
the live project only as the explicitly named `legacy` alias. Every future alpha operation must name
its separate reviewed project. A structurally valid local build is not proof that the project, key
restrictions, claims, quotas, billing alerts, rules, indexes, Functions, or Hosting are cloud-ready.
The exact console checklist, merge-preserving claim grant/revoke lifecycle, token-revocation window,
deployment order, and rollback/lockdown sequence are recorded in
[`FAMILY_ALPHA_RUNBOOK.md`](FAMILY_ALPHA_RUNBOOK.md).

1. **Product:** Phase A uses the existing eight-pair 14-day protocol to test the already-built core.
   It may authorize continued group investment, not production groups. Production group approval
   additionally requires the eight-circle Phase B protocol in `GROUP_VALIDATION_PLAN.md`, including
   cold-plan comparison, multiplayer participation, plan #2, veto trust, and chat-receipt evidence.
   The anonymous Phase B schema, aggregate group-Pick summary, deterministic evaluator, and schema-v3
   cutover evidence fields are implemented locally. They contain no observations yet and therefore
   cannot make group cutover ready.
2. **Data:** the loss-aware read-only planner, production-shaped fixtures, idempotency proof, and create-only rollback manifest are implemented in [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md). Run and manually reconcile a dry-run for each intended pilot account before authoring any apply executor.
3. **Authorization:** run the v2 emulator suite; remove the live `isDevMode`/2030 backdoor; test production-shaped users, invitations, connections, saves, and Picks.
4. **Indexes:** `v2/firestore.indexes.json` now declares the required collection-group composite
   index on `signals(uid ASC, placeId ASC)`. Projection synchronization depends on that query. In the
   reviewed target project, deploy this index before the projection-sync Functions rollout and wait
   until Firestore reports it **READY** before deploying or enabling those Functions. The emulator and
   local integration suite prove query semantics, stale-lifetime cleanup, and idempotent no-op replay;
   they do not prove that the production index exists, has finished building, or can serve traffic.
5. **Hosting:** build from the repository root and prove `firebase.v2.json` serves `v2/dist`, including direct deep links.
6. **Functions:** the v2 codebase contains an authenticated Maps short-link resolver and a dark,
   authenticated place-photo proxy. The resolver follows at most eight redirects, revalidates every
   hop against Google-owned Maps hosts, cancels response bodies, and cannot act as a general URL
   proxy. The photo proxy accepts only a current candidate in one of the caller's active groups,
   keeps its Google key server-side, reserves an identity-free monthly slot, and fails closed unless
   the operator-owned kill switch and sub-free-cap allowance are valid. Legacy OpenAI/Places
   functions are not part of the cutover target.
   Build, emulate, and deploy from Node 22.x, matching `v2-functions/package.json`; `.nvmrc`,
   `.node-version`, and `npm run runtime:check` enforce the local target. A green Functions emulator
    run under another host version is diagnostic, not production-parity evidence.
   Local parity evidence was rerun under Node 22.23.1: Firebase reported `Using node@22 from host`,
    the Functions unit tests passed, and the full owner export/deletion integration passed.
    Exact long Google Maps URLs with a supported Place ID do not use this resolver or Places at all:
    the browser treats the URL label only as an editable seed and waits for final user confirmation.
    Coordinate-only and lookalike-host inputs fail closed. The dedicated 390×844 Auth/Firestore
    emulator verifier proves zero autocomplete, Details, stub, and resolver requests plus one bounded
    private `user_confirmed` `g:` save. Opaque short links remain the only capture path that needs the
    authenticated allowlisted resolver. This local proof does not activate or validate any cloud
    endpoint.
7. **Cost:** preserve Places field masks, autocomplete sessions, cache behavior, and photo budget
   under the production origin. Reviewed evidence must choose either `fallback_only` or a
   server-counted `budgeted_proxy`, prove the remote kill switch, API-key restrictions, Cloud quota
   review, billing alerts, and SKU telemetry, and keep a proxy allowance below the current 1,000-event
   photo free cap. A billing budget alert alone is not a hard cap.
8. **Observability and expiring records:** the privacy-minimal event schema, rules-bounded 30-day expiry, event TTL field override, seven-day group-invite TTL field override, expiry-aware pilot summary, and rules-backed delivery/privacy integration are implemented. The Admin-only summary derives pair conversion and 14-day Pick closure from existing connection/Pick records without emitting pair keys. After deployment, verify both TTL operations become active and monitor deletion delay; Firestore TTL is asynchronous and expired documents may remain for roughly 24 hours.
9. **Data rights:** canonical export/deletion and their emulator proof are implemented in [`DATA_RIGHTS.md`](DATA_RIGHTS.md). Decide and test the frozen v1 retention boundary before launch.
   The recommended v1 boundary and read-only erasure planner now live in [`V1_DATA_RETENTION.md`](V1_DATA_RETENTION.md); owner approval, production-account reconciliation, and actual backup/log/processor retention evidence remain required.
10. **Pair journey:** the mobile invite → connection → overlap → Pick → Loved path passes against an emulator-connected production build, including durable backend-state confirmation and a zero-error console rerun.
11. **Rollback:** retain the last legacy Hosting release and ruleset identifier; document the person authorized to restore each.
12. **External archive:** the final extraction audit is recorded in [`EXTERNAL_V2_AUDIT.md`](EXTERNAL_V2_AUDIT.md). Preserve its dirty work explicitly, then archive it outside the active workspace.
13. **Public legal/privacy:** `/terms` and `/privacy` are implemented for the closed pilot and
    incorporate the relevant Google Maps terms and Google Privacy Policy. Before public cutover,
    add the operator's legal identity and durable private contact, obtain legal review, and remove
    the pending-review markers described in [`LEGAL_AND_PRIVACY.md`](LEGAL_AND_PRIVACY.md).

## Commands

```bash
npm run status:cutover   # informative; exits zero
npm run cutover:check    # strict; refuses while any known blocker remains
npm test                 # canonical domain + authorization suite
npm run build            # canonical v2 production bundle
npm run dev              # guarded Auth + Firestore + Functions emulators and Vite
npm run firebase:serve   # guarded full-stack Hosting emulator build
npm run family-alpha:check # validate an ignored separate-project config; no network
npm run family-alpha:surface # validate the exact secret-free backend allowlist; no network
npm run family-alpha:verify-rules # prove claimed allow/unclaimed deny in a demo emulator
npm run family-alpha:build # generate ignored claim-gated backend + verified app artifact; no deploy
npm run verify:zero-api-link-ui # prove exact-link capture with Places/stub off
npm run verify:hosting   # prove root and deep links serve the v2 shell
npm run cutover:evidence # validate the ignored reviewed-evidence file
```

`npm run firebase:deploy` is intentionally chained through the strict check. Do not bypass it with a raw Firebase command merely to make deployment convenient.

## Reviewed evidence contract

Repository structure cannot prove production facts. Before strict cutover can pass, copy
[`../../cutover-evidence.template.json`](../../cutover-evidence.template.json) to
`cutover-evidence.local.json` and replace every placeholder with reviewed evidence. The local file
is ignored by Git and contains only operational metadata and SHA-256 digests—never participant
UIDs, place history, notes, queries, invite tokens, or raw pilot records.

`npm run cutover:evidence` requires:

- the Phase A eight-pair evaluator decision `proceed_private_preview`, zero trust failures, and a
  report digest; this field is necessary but explicitly insufficient for a group production cutover;
- intended and reconciled migration-account counts to match, zero unresolved manual review, and
  the reviewed plan digest;
- the deployed live ruleset identifier and an explicit attestation that the prototype backdoor is
  absent;
- reviewed TTL policy, a named post-deploy verifier, and a deletion-delay measurement plan;
- retained Hosting and Firestore rollback identifiers plus a rehearsal timestamp;
- the external archive manifest digest and confirmation that its active path was retired;
- named cutover and rollback owners whose approval timestamp is not earlier than any evidence.

The current evidence schema does not yet represent composite-index deployment state. Until reviewed
evidence records the target project, exact index definition, deployment, and **READY** observation, the
index gate remains blocked even when the tracked manifest and emulator suite are green. Roll out the
index first; do not use a missing-index production error as the deployment test for projection sync.

The validator rejects unknown fields, placeholders, malformed hashes, future timestamps, partial
cohorts, mismatched migration counts, unsafe rules, and premature approval. This prevents a local
code edit from being mistaken for production readiness. TTL activation and observed deletion delay
remain post-deploy checks owned by the named verifier; the evidence file proves that follow-up is
assigned, not that asynchronous deletion has already occurred.

Root command names are part of the authority boundary. Canonical `dev`, `build`, `preview`, `lint`, `test`, and verification commands target v2. Operations that exist only for frozen v1—including database setup/deploy/reset, old audit screenshots, Maps tests, and the old smoke suite—must retain the `:v1` suffix. `status:cutover` verifies that no ambiguous aliases return.

## Rollout shape

Use a reversible preview or secondary Firebase Hosting channel first. Test with invited pairs only, compare activation and decision completion against the stated success criteria, then promote the exact verified artifact. Rules and data migrations require their own reviewed step; a hosting preview is not authorization to deploy either.
