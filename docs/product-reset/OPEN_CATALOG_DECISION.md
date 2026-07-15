# Open catalog source and serving decision

**Decision date:** July 13, 2026  
**Status:** bounded operator-invoked acquisition architecture and fail-closed area-search boundary implemented; real ingestion and user-facing serving remain off

## Decision

Use **Overture Places as the single primary owned/open catalog spine**. Do not merge a second global
catalog into the first pilot. Foursquare Open Source Places remains a quality/completeness benchmark,
not a second production identity system. Direct OpenStreetMap place ingestion remains deferred unless
legal review explicitly accepts the ODbL derivative-database and attribution obligations.

This decision does not authorize a production download, deployment, hard-coded city catalog, or
unfamiliar-place UI. It selects the source contract so the next implementation can be reviewed rather
than continuing behind a fictional provider-neutral abstraction.

## Evidence current on July 13, 2026

| Source | Useful facts | Cost/operational boundary | Decision |
|---|---|---|---|
| Overture Places | Public GeoParquet on AWS/Azure; anonymous STAC latest-release pointer; GERS identity; names, Point geometry, `basic_category`, taxonomy, operating status, confidence, websites, and per-feature sources | Monthly releases can contain minor schema changes; public buckets retain only the latest two months; Places attribution includes CDLA Permissive 2.0, Apache 2.0, and CC0 sources, so release attribution/NOTICE must be snapshotted | **Primary spine** |
| FSQ OS Places | Apache 2.0; 20+ core fields; explicit unresolved-quality flags; monthly deltas including add/update/remove/merge; 108,881,352 POIs in the July 2026 notes | Current access requires a Foursquare Places Portal account/token and an Iceberg client; it adds a second taxonomy and identity/conflation system, while Overture already includes transformed Foursquare data | Benchmark only; no dual ingest |
| OpenStreetMap | Broad community coverage and mature ecosystem | ODbL attribution and share-alike obligations apply to a publicly used derivative database | Deferred pending legal/product need |

Primary sources:

- [Overture quickstart and public STAC/GeoParquet access](https://docs.overturemaps.org/getting-data/)
- [Overture DuckDB bounding-box access](https://docs.overturemaps.org/getting-data/duckdb/)
- [Overture release calendar and retention](https://docs.overturemaps.org/release-calendar/)
- [Overture Places schema](https://docs.overturemaps.org/schema/reference/places/place/)
- [Overture per-property source and license schema](https://docs.overturemaps.org/schema/reference/core/source_item/)
- [Overture taxonomy schema](https://docs.overturemaps.org/schema/reference/places/types/taxonomy/)
- [Overture attribution and licensing](https://docs.overturemaps.org/attribution/)
- [Foursquare OS schema and Apache 2.0 notice](https://docs.foursquare.com/data-products/docs/places-os-data-schema)
- [Foursquare current portal/Iceberg access](https://docs.foursquare.com/data-products/docs/access-fsq-os-places)
- [OpenStreetMap copyright and ODbL](https://www.openstreetmap.org/copyright)

The repository record is an engineering decision, not legal advice. Public activation still requires
owner/legal review of the pinned release's attribution and NOTICE files.

## Exact durable row boundary

An admitted row contains only:

```text
GERS id
primary name
Point geometry
basic category
taxonomy primary / hierarchy / alternates
operating status
confidence
one website when valid
source dataset + optional SPDX-style license identifiers
pinned release id + schema version + reviewed license-ledger id + ingestion time
```

The current `v1.17.0` taxonomy spells the unordered field `alternates`. The older local contract used
`alternate`; that mismatch is now corrected. `open`, `temporarily_closed`, and `permanently_closed`
describe general operation, not today's hours. Only `open` can enter unfamiliar discovery; missing,
temporary, and permanent status fail closed. No status may be presented as “open now.”

Addresses, phone/email/social fields, brands, ratings, reviews, popularity, hours, and descriptions do
not enter the initial durable row. Google may not fill or correct any of these fields. A raw Google
Place ID may exist only as a separately sourced alias.

### Explicit cross-provider identity only

A known `g:` place and an unfamiliar `o:` row may collapse only through one unambiguous
`user_confirmed` alias at confidence 1. A direct known `o:` identity also excludes itself. Fuzzy
name/coordinate proposals remain review suggestions and cannot suppress a candidate; coordinates
alone never establish identity. If one Google ID points to multiple confirmed Overture IDs, the
conflict suppresses neither row. Malformed aliases are ignored and counted rather than trusted.

Open discovery derives known identities only from current group-visible saves plus an explicitly
provided group-safe set. A private save cannot change another member's shortlist. The domain suite
proves direct identity, explicit alias, fuzzy non-alias, private evidence, and ambiguity behavior.
The deterministic policy and inactive server-owned storage contract now agree. Registry document IDs
are domain-separated SHA-256 hashes of the opaque Google ID; exact-schema bodies contain only bounded Overture
IDs, confirmation status, and time—never the raw Google ID, a user ID, or an actor. Clients cannot
read, enumerate, or write the collection. Server reads are point-only and capped at 100 known Google
IDs; conflicts, malformed rows, and unrequested rows suppress nothing. Cross-compiled parity proves
the client and server exclude the same identities. No alias collection workflow, populated registry,
automatic matcher, or server query wiring exists yet.

## Adaptable serving without location targeting

The catalog is global-capable but request-scoped:

1. A person explicitly chooses an area for the current plan. Device location, home area, prior areas,
   and silent defaults are not inputs.
2. An authenticated server accepts a bounded ephemeral area center/radius and selects intersecting
   open-data cells. It does not persist coordinates on a person, group, taste signal, or event.
3. The server reads a release-pinned compact cell pack, applies operating/category eligibility, and
   passes a bounded set into the deterministic open-discovery policy.
4. Current group-visible category evidence may explain fit. Geography only establishes which catalog
   rows were requested; it adds no taste support and never ranks one member.
5. At most three candidates survive the single shared final-three ceiling, with known evidence first.

No New Jersey, city, or launch-market constant belongs in source or storage layout. A cell exists
because an explicit plan requested its area, not because this.is inferred where a user belongs.

## Cost-aware ingestion and refresh

Do not query global Parquet from a browser or run a paid place lookup per candidate.

1. A separate review may use Overture's release calendar or STAC catalog to choose a release, but the
   acquisition job accepts only the already-pinned release/schema/S3 path in a reviewed manifest. It
   never follows `latest` at runtime and downloads only the reviewed bbox and projected columns.
2. Store compressed immutable cell packs in object storage, not one Firestore document per place.
   One small release pointer swaps atomically after validation.
3. Refresh at most once per Overture monthly release. Stage and diff first; apply closed/removed rows
   before additions; retain one validated prior release only for rollback.
4. A release manifest records source URLs, retrieved time, row counts, rejected counts by reason,
   content digests, attribution/NOTICE locations, schema version, and code version.
5. Runtime reads are bounded by intersecting cell count, raw-row ceiling, response bytes, timeout, and
   a remote kill switch. Log aggregate counts/cost only—never requested area, coordinates, place ids,
   group ids, or member ids.
6. Do not ingest FSQ separately during the pilot. Dual ingest doubles refresh, attribution, identity,
   deletion, and dedup work before evidence says unfamiliar discovery is valuable.

Public object-storage and batch compute still have egress/compute/storage costs. “Open data” means no
per-place content license fee here; it does not mean free infrastructure.

### Implemented planning gate

`npm run catalog:plan` now reads only `open-catalog-manifest.local.json` (or `--file`) and emits a
bounded JSON summary. The local file is Git-ignored; `open-catalog-manifest.template.json` contains
placeholders that intentionally fail validation. The planner performs no network call, download,
filesystem write, deployment, or activation.

The strict manifest pins release/schema/S3 path and reviewed attribution digests; bounds an anonymous
bbox, cell count, rows, and bytes; fixes all privacy/activation switches off; and distinguishes
`planned` from `extracted`. An extracted claim additionally requires a relative artifact path,
byte count, SHA-256 digest, generation time, and accepted/rejected counts whose reason ledger sums
exactly. Unknown keys—including identity fields—are rejected. `--require-extracted` prevents a plan
from being mistaken for an artifact. This proves planning evidence only; it is not an extractor.

### Implemented extraction policy core

`openCatalogExtraction.ts` now applies the row boundary to already-provided in-memory rows without
network, filesystem, Firebase, identity, or activation capability. It requires a valid bounded bbox
and row/cell ceilings, requires per-row source dataset and optional license provenance, admits only general `open` status
and supported product categories, excludes out-of-area rows, deduplicates GERS identity, and emits
stably ordered in-memory cell packs. Every raw row is either accepted once or assigned exactly one
rejection reason; the rejection ledger must reconcile to the raw count. Closed-but-valid status is
kept distinct from malformed status, and duplicate identity is explicit in the manifest contract.

The tests use synthetic fixtures only.

### Explicit GeoParquet acquisition runner

`npm run catalog:extract` now compiles the reviewed domain codec and invokes an operator-supplied
absolute DuckDB executable path only after `--confirm-network`. `--print-sql` supports review without
network access. The runner accepts only a valid `planned` manifest, checks DuckDB 1.1.0 or newer, and
loads already-installed `spatial` and `httpfs` extensions without installing anything. Its SQL uses the
manifest's exact release S3 URI, contained-point bbox predicates, only the required columns, stable ID
ordering, and `maxRawRows + 1`; the overflow row makes an undersized bbox requirement fail instead of
silently truncating it.

DuckDB writes temporary NDJSON under `output/open-catalog`. The runner enforces the raw byte and row
ceilings, feeds every row through normalization/extraction/the compact codec, enforces the final byte
ceiling, writes one no-overwrite artifact, calculates SHA-256, deletes temporary raw rows, and prints
only an aggregate manifest-ready summary. It never edits the reviewed manifest, uploads, contacts
Firebase, or enables serving. Source dataset and optional license stay paired through normalization,
artifact generation, and the Functions reader; absent license remains absent rather than inferred.

The executable suite uses a fake local DuckDB process and proves version, release URI, bbox, projection,
overflow, license, digest, no-overwrite, safe-output, cleanup, and inactive-serving boundaries. The
machine currently has no DuckDB executable, no reviewed local manifest, and no real artifact. Therefore
no Overture request or real ingestion has occurred, and an extracted manifest, object-storage write,
refresh/diff process, or enabled place-serving path still does not exist.

## Area-resolution decision: pinned GeoNames gazetteer

The current plan-area field remains plain text for known member-confirmed places. It must never become
latitude/longitude by guessing. For unfamiliar retrieval, the selected development path is a separate
owned GeoNames gazetteer built from a pinned `cities500.zip` download plus the required administrative
name tables. GeoNames publishes downloadable global extracts under CC BY 4.0, permits commercial use,
and describes `cities500` as populated places above 500 people or administrative seats (about 185,000
rows). The local release ledger must record source URLs, retrieval time, SHA-256 digests, parser
version, license/attribution snapshot, row counts, and rejection counts. Public attribution must name
and link GeoNames. This engineering choice is not legal approval.

The first resolver contract is deliberately narrow:

1. No device, IP, home, prior plan, group history, or launch-market bias enters search.
2. The person explicitly opens **Area**, types 2–80 characters, and sees at most five globally matched
   locality suggestions with enough region/country context to disambiguate them.
3. No top result is silently accepted. Only a tap on one named suggestion creates an ephemeral
   `explicit_plan` center for the current draft.
4. The initial retrieval language is **Near [selected area]**, not “inside” a municipal boundary or
   “where you are.” A fixed, documented 12 km development radius avoids invented boundaries and
   hidden population-based reach. Real-group evidence may revise that one constant before activation.
5. Gazetteer id and coordinates are request logistics only. They are not written to a person, group,
   signal, event, public receipt, or durable Pick; the existing bounded human-readable plan-area label
   is the only area value a confirmed private Pick may retain.
6. The resolver runs against a release-pinned compact server-owned index, returns at most five rows,
   has a kill switch and aggregate request/error counts, and logs no query, coordinates, gazetteer id,
   user id, group id, or selected area.

The GeoNames live web service is not used, so it adds no per-query third-party dependency or daily
request quota. The full global dump is not shipped to browsers.

### Alternatives rejected for the development baseline

- **Google Places region autocomplete:** current Autocomplete supports `(regions)`/`(cities)`, session
  tokens, and explicit Details selection, but non-ID Places content is cache-restricted, field masks
  affect billing, and using Google coordinates to drive an open-data spatial query requires specific
  terms review. It would also introduce a paid provider call into every unfamiliar-plan area search.
  Keep it out of this resolver unless owner/legal review explicitly approves that combination.
- **Overture Divisions:** it has excellent global locality/hierarchy/area data and shares release
  mechanics with Places, but Overture documents the Divisions theme as ODbL-derived. Adding it would
  reintroduce the database-license review deliberately avoided for the permissive Places spine.
- **Free-form text geocoding:** ambiguous strings cannot be converted to coordinates without an
  explicit named selection. Coordinates alone never become place identity.

The authenticated `/searchPlanAreas` boundary now provides the server half of area selection. It is
available only to current members of an active group, reads an operator-owned remote kill switch,
allows one bounded object-storage path, verifies bytes and SHA-256, and binds the artifact's snapshot,
license-ledger id, and accepted-area count before caching it. Search returns at most five global text
matches with GeoNames/CC BY attribution. Its only telemetry is one aggregate UTC-month request count;
queries, coordinates, gazetteer ids, group ids, and user ids are not logged. Missing, malformed,
disabled, mismatched, or unreadable configuration fails closed as unavailable.

The successful path is unit-tested with synthetic artifacts; Auth/Firestore/Functions integration
proves authentication, group membership, query bounds, and disabled-state behavior. There is still no
reviewed real manifest, generated index, deployed object, enabled-endpoint integration proof, client
picker, or unfamiliar-place service. Until those are implemented and reviewed, the app must continue
saying unfamiliar retrieval is unavailable.

### Implemented gazetteer planning gate

`npm run gazetteer:plan` now reads only `area-gazetteer-manifest.local.json` (or `--file`) and prints
a bounded summary. The local manifest is Git-ignored; `area-gazetteer-manifest.template.json` is
tracked and intentionally invalid until real reviewed evidence replaces every placeholder. The
command performs no network call, download, filesystem write, parsing, indexing, deployment, search
activation, or GeoNames request.

The strict manifest pins the snapshot date, canonical `cities500`/admin1/admin2 source URLs and
SHA-256 digests, parser contract, GeoNames plus CC BY attribution digests, row/index/query/radius
ceilings, explicit-selection-only privacy, and disabled server search/deployment. An `indexed` claim
additionally requires an artifact path under `output/area-gazetteer`, byte count, SHA-256,
generation time, positive administrative-table counts, and accepted/rejected city counts whose
nine-reason ledger reconciles exactly. Unknown keys—including identity fields—fail closed.
`--require-indexed` prevents a plan from being mistaken for an index. This is planning proof only;
no index exists.

The matching pure index policy now accepts only already-provided city/admin rows plus the pinned
context and explicit ceilings. It validates both administrative tables, preserves source rows while
discarding only blank lines, parses every city row into exactly one acceptance or one of the same
nine rejection reasons, treats provenance failure as a batch failure rather than blaming a row,
deduplicates identity deterministically, measures the serialized result in memory, and fails closed
on raw-row, accepted-row, or byte ceilings. Its tests use synthetic rows only. It has no network,
filesystem, Firebase, browser-storage, server, artifact-write, or activation capability; a real
download, artifact, endpoint, attribution surface, and UI still do not exist.

### Deterministic artifact codec and inactive reader

The pure extraction boundary now feeds a deterministic compact codec. Before serialization, it
rechecks release/schema/license/timestamp provenance on every place, bbox and cell membership, stable
cell/place ordering, unique identities, open status, and accepted-row reconciliation. It emits only
the fields accepted by the server artifact schema, deliberately dropping internal `gersId`, ingestion
timestamp, operating-status repetition, and every unknown provider field. Identical validated input
produces identical JSON. A cross-compiled parity test hashes those generated bytes, builds the server
configuration from the extraction counts, parses the result through the Functions reader, and applies
an explicit-area spatial query. This is an executable contract, not a real data artifact.

The Functions package now contains a pure, unmounted reader for the eventual Overture cell pack. It
requires an operator configuration that pins the object path, byte ceiling, SHA-256, release, Overture
schema, reviewed license ledger, accepted-row count, and cell count. The parser rejects unknown keys at
the envelope, cell, taxonomy, and place boundaries, including any smuggled Google alias or identity
field. It also rejects duplicate place identities, mis-celled coordinates, out-of-bbox rows, unstable
ordering, manifest mismatches, and count drift before returning data.

The adjacent spatial query accepts only a bounded `explicit_plan` center and radius, returns at most
64 distance-ordered rows, and uses neither device location nor person/group history. That output is
only a candidate pool; the separate group-evidence policy must still reduce it into the shared
final-three. One verified artifact is cached per warm server instance. This module is deliberately not
imported by `index.ts`, has no Firebase or storage capability of its own, and exposes no HTTP endpoint.
Its passing synthetic test is parser/serving-contract evidence, not a real extraction or activation.

### Implementation stop

Claude Entry 059 correctly warned that even dark serving machinery can out-run the owner and pilot
decision it was meant to protect. This boundary is therefore sufficient for now: do not add an HTTP
endpoint, storage upload, alias-population workflow, real extraction, or user-facing catalog wiring
until the activation gates below are reviewed. Further schema preparation is not a substitute for
evidence that unfamiliar candidates improve a real group's decision.

## Activation gates

Before one open candidate appears in the app, require all of the following:

- pinned release and schema accepted by a strict manifest validator;
- reviewed attribution/NOTICE snapshot and public product attribution;
- current-schema fixture proving `alternates`, operating status, and per-feature sources;
- reproducible area-cell extraction with row/rejection/digest report;
- no Google fields in the durable output;
- explicit-area resolver with no person/group location profile;
- server-owned storage and serving-path wiring for the implemented explicit-only `g:` ↔ `o:` dedup policy;
- bounded query service, kill switch, quotas, aggregate cost telemetry, export/deletion review, and rollback;
- real-group pilot evidence that unfamiliar candidates improve decisions rather than add browse noise.

## Not chosen

- no client-side global catalog download;
- no live query to Overture on every page view;
- no Firestore collection of millions of place documents;
- no dual Overture + FSQ identity graph for the pilot;
- no device/home location targeting;
- no city-specific product fork;
- no claim that open data supplies photos, trustworthy descriptions, hours, accessibility, or group fit.
