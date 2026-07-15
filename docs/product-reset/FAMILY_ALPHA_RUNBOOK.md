# this.is family-alpha operator runbook

**Status:** local release artifacts exist; no cloud project, account claim, or deployment is implied by this document.

This is the operator path for a private dogfood with the owner's family. It is not a production cutover, does not use or copy the live legacy project, and never treats a successful local build as proof of cloud configuration.

## Non-negotiable boundary

- Use a new, empty Firebase project. Every Firebase command must name that project explicitly with `--project`; never add it as the default alias in `.firebaserc`.
- Use Node 22 and the generated `firebase.family-alpha.json` surface only.
- Keep `.env.family-alpha.local` and any account UIDs untracked. Do not put names, email addresses, UIDs, service-account JSON, or API-key values in this document or another tracked file.
- Keep photos disabled. The family package intentionally has no `placePhoto`, `PLACES_SERVER_KEY`, or pair migration.
- Custom claims are authorization only. Granting or removing one does not migrate, remove, or anonymize a person's data.

## 1. Prepare the separate project

Review these in the Firebase and Google Cloud consoles before any deploy:

1. Confirm the selected project ID is the exact ID in both family-alpha project fields in `.env.family-alpha.local`, and confirm it is neither `this-is-76332` nor an emulator project.
2. Register one Web app and copy only its public Web configuration into the dedicated environment file.
3. Enable only Google sign-in for this alpha. Add the exact Hosting or preview hostname to Firebase Authentication's authorized domains; do not use a wildcard domain.
4. Create the empty default Firestore database in the intended region. Do not import users, documents, Storage objects, or backups from legacy.
5. Link billing because Places API (New) and deployed Functions require it. Enable Places API (New), not unrelated Maps services.
6. Create a Places browser key separate from the Firebase Web API key. Restrict it to the exact alpha website origin(s) and to Places API (New). Add a preview origin only while that preview is in use, then remove it.
7. Set deliberately low per-method Places quotas appropriate for a few family members. Create a project-scoped billing budget and alerts, while acknowledging that a budget alert is not a hard spending cap.
8. Confirm the family build still has `VITE_GROUP_PHOTOS_ENABLED=false`; do not create a server Places secret.

Google's current guidance requires application and API restrictions on Maps keys and separate keys per application. Places billing is request/SKU based, and field masks affect the billed SKU. See [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices) and [Places usage and billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing). Firebase's Google sign-in setup requires the provider and every app domain to be explicitly enabled; see [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## 2. Prove the local release

From the repository root, on Node 22:

```bash
npm run runtime:check
npm run family-alpha:surface
npm run family-alpha:check
npm run family-alpha:verify-rules
npm run family-alpha:build
```

These commands are local checks. They neither inspect the console settings above nor contact, provision, or deploy the project. Before authorizing a cloud operation, review the generated rules, the 19-name Functions allowlist, and the visible family-alpha marker in the built app.

Retain a reproducible reference to the exact source and generated release before the first deploy. A source commit plus recorded artifact digests is preferable. A dirty working tree or a screenshot is not a Functions rollback artifact. Never commit the built browser bundle because it contains public browser-key material.

## 3. First deployment order

No deploy command is intentionally included in `package.json`. When the owner separately authorizes a first cloud operation, use the installed Firebase CLI and pass both `--project <exact-alpha-project>` and `--config firebase.family-alpha.json` on every command.

Deploy in this order:

1. Generated Firestore rules and indexes.
2. Wait in the Firestore console until the `signals(uid ASC, placeId ASC)` collection-group index reports **READY**. Do not use a production missing-index failure as the test.
3. Generated family-alpha Functions. Verify the deployed names equal the reviewed 19-name allowlist and that `placePhoto` and `migratePairToGroup` do not exist.
4. Hosting to a short-lived preview channel if practical. Add its exact domain to Auth and Places restrictions before testing it. Otherwise use only the isolated alpha site's live channel.
5. Exercise signed-out, authenticated-but-unclaimed, claimed, group creation/invite, private Keep, one Pick, Maps handoff, export, and account-deletion paths on disposable alpha-only data.

Firebase partial deployments overwrite the selected service's configured state, so review the explicit project and config immediately before each operation. See the [Firebase CLI deployment reference](https://firebase.google.com/docs/cli).

## 4. Grant family access safely

A family member must first complete Google sign-in once so the separate project's Auth user exists. Until the claim is granted, their signed-in session must remain denied by both Firestore and authenticated HTTP paths.

The future admin-only grant procedure must have all of these properties:

1. It defaults to a dry run and refuses any project other than the exact alpha project.
2. The operator selects the Auth UID only after matching the expected Google account in the Firebase Auth console. UIDs and email addresses stay out of Git and normal logs.
3. It fetches the user's current custom claims, merges `familyAlpha: true`, and preserves every unrelated claim. `setCustomUserClaims` replaces the whole claims object; writing only `{ familyAlpha: true }` is unsafe.
4. It writes through a privileged Admin SDK environment, never through the browser app, a public callable, or a committed service-account key.
5. It refetches the user and verifies the exact claim after writing.
6. The member signs out and in again, or explicitly forces an ID-token refresh, before access is expected. Custom claims appear only in a newly issued ID token.
7. The operator verifies one allowed Firestore read and one authenticated app endpoint, then confirms a different signed-in but unclaimed account remains denied.

Firebase documents both the replacement behavior and token-refresh requirement in [Control access with custom claims](https://firebase.google.com/docs/auth/admin/custom-claims). The repository does not yet contain a grant command because selecting real accounts and authorizing an Admin mutation are owner actions.

## 5. Revoke access and offboard

Choose the sequence based on why access is ending:

- **Ordinary voluntary departure:** while still authorized, have the member leave applicable groups or use the in-app account-deletion path. Confirm the data-rights operation before removing access.
- **Immediate trust or device incident:** stop access first, then handle retained data and receipts as a separate reviewed operation. Do not wait for self-service cleanup.

The admin-only revoke procedure must:

1. Assert the exact alpha project and refetch the exact Auth user.
2. Preserve unrelated custom claims while deleting only `familyAlpha` (or setting that claim to false).
3. Refetch and verify the claim is absent or false.
4. Revoke the user's refresh tokens.
5. Verify a newly issued token cannot read Firestore or call an authenticated endpoint.

Revoking refresh tokens is not an instant Firestore kill switch for an ID token already issued with the old claim. Firebase ID tokens last for about one hour. The alpha HTTP functions call `verifyIdToken(token, true)` and check revocation, but the generated Firestore rules inspect the JWT claim and do not maintain a separate per-user revocation timestamp. If immediate Firestore cutoff is required, deploy a reviewed deny-all ruleset to the **explicit alpha project**, then investigate; otherwise wait out the old token lifetime before declaring revocation complete. See [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions).

Claim removal also does not revoke an already-public opaque Pick receipt or remove group membership/data. Before ordinary offboarding, close/revoke receipts and leave groups or complete account deletion. During an incident, inventory those surfaces explicitly after access is contained.

## 6. Rollback and incident containment

Before every alpha release, record outside participant data:

- exact source revision and generated artifact digests;
- Firebase Hosting release or preview-channel identifier;
- Firestore ruleset identifier and index state;
- deployed Functions names and release time;
- the one person authorized to roll back or lock down the alpha.

Use the narrowest response that matches the incident:

- **Bad UI release:** roll Hosting back to the retained prior Hosting version; do not touch rules or data.
- **Bad Function release:** rebuild the retained exact prior source and redeploy only the reviewed family-alpha Functions codebase. A digest without retained source is not sufficient rollback material.
- **Authorization or data-exposure concern:** deploy reviewed deny-all Firestore rules to the explicit alpha project, remove affected claims, revoke refresh tokens, and stop sharing the site. Delete Functions only as an explicitly reviewed incident step; omission from an unrelated deploy must never be used as an implicit deletion plan.
- **Unexpected Places spend:** disable the Places key or API and set `VITE_PLACES_ENABLED=false` in the next build. Billing alerts report spend; they do not cap it.

Do not restore legacy rules, data, Functions, or Hosting into the alpha project as a rollback. Preserve alpha data for diagnosis unless the reviewed incident/data-rights response requires deletion.

## Still external and unproven

Local code cannot prove the project is empty, the correct operator is signed in, billing and quotas are configured, API restrictions have propagated, Auth domains/providers are correct, the composite index is ready, claims were granted to the intended accounts, or a cloud release can be rolled back. Those remain console-observed owner evidence. Do not replace them with checked booleans in a tracked template.
