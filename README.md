# this.is

**Canonical product:** the in-repository [`v2/`](v2/) application.

this.is helps a recurring group of 2–6 people answer one question: **where do our tastes already meet?** Each person keeps places as Want, Tried, or Loved. A private group view turns that real history into at most three plan candidates with truthful reasons. A pair is simply the smallest group.

The product is intentionally not a public social feed, review network, generic map, editorial catalog, or another voting deck.

## Repository authority

| Surface | Status | Rule |
|---|---|---|
| [`v2/`](v2/) | Canonical | All product and implementation work happens here. |
| [`v2-functions/`](v2-functions/) | Canonical minimal backend | Authenticated Maps short-link resolution only; no legacy AI/discovery functions. |
| Root `src/` | Frozen v1 | Historical reference only; use explicit `:v1` commands. |
| `C:\Users\mikus\this-is-v2` | Superseded clean-room prototype | Extract only a demonstrably better primitive; do not merge architectures. |
| [`docs/product-reset/`](docs/product-reset/) | Canonical product record | Thesis, research, UX contract, plugin audit, and cutover evidence. |

## Work on the canonical app

Use Node 22, matching the Firebase Functions production runtime. Both `.nvmrc` and
`.node-version` pin the project; `npm run runtime:check` fails if the active process is not 22.x.

```bash
npm run runtime:check
npm run dev
npm test
npm run typecheck
npm run build
npm run status:cutover
```

The default root commands delegate to `v2/`. Historical v1 commands remain available as `npm run dev:v1`, `npm run build:v1`, and `npm run preview:v1`.

All other legacy-only operations are also explicitly suffixed `:v1`, including database setup/deploy/reset, old screenshot audits, Maps tests, and the old Playwright suite. There is deliberately no unnamespaced `db:deploy`, `status:ui`, or `test:smoke`: those names previously made frozen v1 look canonical.

## Run the private-pilot evidence gate

```bash
npm run pilot:summary -- --since YYYY-MM-DD > pilot-summary.pilot-private.json
npm run pilot:decision -- --observations pilot-observations.pilot-private.json --summary pilot-summary.pilot-private.json
```

Copy the bounded observation structure from
[`PILOT_OBSERVATIONS.template.json`](docs/product-reset/PILOT_OBSERVATIONS.template.json). Filled
files ending in `.pilot-private.json` are ignored by Git. The evaluator prints aggregate gates
only; see [`VALIDATION_PLAN.md`](docs/product-reset/VALIDATION_PLAN.md) before recruiting anyone.

## Deployment status

There is deliberately no unchecked production cutover. `npm run firebase:deploy` runs a strict
readiness gate first. It refuses while repository hazards remain or while
`cutover-evidence.local.json` does not prove the reviewed pilot, migration reconciliation, live
ruleset, TTL follow-up plan, rollback identifiers, accountable owners, and external preservation.
Copy [`cutover-evidence.template.json`](cutover-evidence.template.json) only when those facts exist;
the filled local file is Git-ignored. `npm run firebase:serve` builds and previews the canonical v2
hosting target locally.

Read [CUTOVER.md](docs/product-reset/CUTOVER.md) before changing hosting, rules, indexes, or production data.

## Product authority

- [Documentation map](docs/README.md)
- [Product reset](docs/product-reset/THIS_IS_RESET.md)
- [Approved group direction](docs/product-reset/GROUP_DIRECTION.md)
- [Claude stress-test response](docs/product-reset/CLAUDE_STRESS_TEST_RESPONSE.md)
- [Discovery and enrichment engine](docs/product-reset/DISCOVERY_ENGINE.md)
- [Current state and executable backlog](docs/product-reset/CURRENT_STATE.md)
- [UX architecture](docs/product-reset/UX_ARCHITECTURE.md)
- [Canonical v2 implementation notes](v2/README.md)
- [Plugin and research workflow](docs/product-reset/PLUGIN_AUDIT.md)
- [Phase A pair validation](docs/product-reset/VALIDATION_PLAN.md)
- [Phase B group validation](docs/product-reset/GROUP_VALIDATION_PLAN.md)
- [Loss-aware v1 → v2 migration plan](docs/product-reset/MIGRATION_PLAN.md)
- [Canonical data export and deletion contract](docs/product-reset/DATA_RIGHTS.md)
- [Frozen v1 data retention and erasure decision](docs/product-reset/V1_DATA_RETENTION.md)

Google Places remains a cost-controlled logistics backend. Preserve minimal field masks, caching, the photo budget, and explicit-details-only behavior.
