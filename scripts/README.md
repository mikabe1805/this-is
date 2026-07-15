# Repository scripts

This directory contains both canonical safety tooling and frozen v1 utilities. Do not infer authority from a script's age or filename.

## Canonical, non-deploying tooling

- `check-v2-cutover.mjs` — reports structural readiness and blocks strict cutover when known gates remain.
- `check-doc-authority.mjs` — classifies root and nested historical documents and rejects new ambiguous root guides.
- `check-node-runtime.mjs` — requires the Node 22.x runtime used by canonical Firebase Functions.
- `check-cutover-evidence.mjs` / `cutover-evidence-core.*` — validates reviewed production metadata and digests without reading participant data.
- `check-v2-hosting.mjs` — verifies the canonical Hosting shell and deep links against an emulator.
- `build-v2-emulator.mjs` / `check-v2-group-draft-ui.mjs` — builds the production-mode client with local-only Firebase configuration and proves shared draft-pass behavior across two isolated authenticated browsers.
- `check-v2-data-rights.mjs` — verifies owner export and deletion through Auth, Firestore, and Functions emulators.
- `pilot-summary-core.*` / `summarize-v2-pilot.mjs` — identity-free pilot aggregation.
- `pilot-decision-core.*` / `evaluate-v2-pilot.mjs` — anonymous qualitative gates plus the protocol decision.
- `pilot-operator-readiness-core.*` / `check-pilot-operator-readiness.mjs` — fails closed before participant contact unless the ignored operator, access, retention, exclusion, review, and deletion-rehearsal card is complete; it never reads participant data.
- `plan-v2-migration.mjs` — read-only v1 → v2 migration plan.
- `plan-v1-erasure.mjs` / `v1-erasure-core.*` — read-only frozen-v1 erasure plan.
- `plan-external-v2-archive.mjs` / `external-v2-archive-core.*` — read-only dirty-work fingerprint for the superseded external prototype.

Run these through the root `package.json` commands documented in [`../README.md`](../README.md).

## Frozen v1 utilities

Database seed/setup/reset scripts, `audit/`, `tests/`, coordinate/list cleanup scripts, and other legacy management files target the retired social-discovery architecture. They may write or delete Firebase data.

Their root commands are intentionally suffixed `:v1`—for example `db:setup:v1`, `db:deploy:v1`, `status:ui:v1`, and `test:smoke:v1`. Never run them for canonical work, never point them at production while evaluating v2, and do not call the underlying files directly to bypass the namespace.

The canonical data model and cutover rules live in [`../docs/product-reset/CUTOVER.md`](../docs/product-reset/CUTOVER.md), [`MIGRATION_PLAN.md`](../docs/product-reset/MIGRATION_PLAN.md), and [`V1_DATA_RETENTION.md`](../docs/product-reset/V1_DATA_RETENTION.md).
