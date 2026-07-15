# this.is — discovery and enrichment engine

**Status:** Overture source architecture and shortlist policy chosen; catalog ingestion/serving absent  
**Date:** July 11, 2026  
**Companion:** [`GROUP_DIRECTION.md`](GROUP_DIRECTION.md)

## Decision

this.is has two related jobs:

1. **Decide:** reduce a group's known evidence to at most three truthful choices.
2. **Discover:** surface unfamiliar places that plausibly fit the people involved without building a
   location profile.

Exact overlap alone cannot do the second job. A name and category alone cannot earn a decision. The
discovery engine is therefore a hybrid of open place data, bounded live Google enrichment, explicit
this.is taste, and—only after enough real density—privacy-preserving trust-weighted recommendations.

Users are not responsible for creating the initial place catalog or supplying every first image.
Their contributions make the product more personal and less vendor-dependent over time.

## The candidate-card contract

Every unfamiliar candidate must answer four questions without opening Google Maps:

1. **What is it?** One photo or designed fallback, specific place type, and area.
2. **Why might we like it?** Exact shared evidence, a taste-fit explanation, or a trust explanation.
3. **Will it work tonight?** Only verified plan-relevant constraints such as price, open status,
   children, groups, dietary needs, outdoor seating, or accessibility.
4. **Whose evidence is this?** Group member, anonymous taste neighborhood, Google, business source,
   or this.is community.

The compact form is:

```text
[one image]
Place name                         Korean restaurant
Warm tabletop cooking; built for sharing.                [source]
Why for us: Vivian loved similar places; 3 taste neighbors loved this.
Good for groups · Dinner · $$                             [source chips]
```

No empty name-only cards. No scraped prose. No invented atmosphere. No public star score or global
rank as the primary reason.

The local group surface now implements the no-cost baseline of this contract: known match, named
member introduction, and weak exact-signal-plus-hint are visibly different; each card carries a
user-confirmed label, member-chosen category, exact group reason, unknown-facts warning, and an amber
place-mark fallback when no photo is available. This makes the current shortlist honest and legible.
Known-place capture can now add one optional area typed and confirmed by the person. That area travels
with the user-owned memory and exact group projection, appears as a sourced card fact, and never
becomes a home or location profile. It is not copied from Google's address response. The baseline
still does **not** supply a richer factual description or a candidate nobody in the group kept. Those
require user contribution, the open-catalog/retrieval work below, or bounded live enrichment.

The active group draft can optionally filter those known places with up to 80 characters of explicit
meeting-area text. Matching is Unicode-aware and deterministic: every typed word must occur in the
user-confirmed place area; missing area is unknown, not a match. The text lives only in component
state and is never geocoded, persisted, emitted as an event, or reused as a person/group default.

## Four data layers

### 1. Durable open catalog

Use Overture Places as the chosen development catalog spine under
[`OPEN_CATALOG_DECISION.md`](OPEN_CATALOG_DECISION.md): GERS ID, location, basic category/taxonomy,
general operating status, confidence, website, and per-feature sources. Only a current `open` status
may enter unfamiliar retrieval; missing, temporarily closed, and permanently closed fail closed.
That status must never answer “open tonight.” The catalog still does not solve photography or
trustworthy prose.

This layer supports explicit place lookup, category matching, vendor exit, and durable feature generation.
It must be conflated carefully with the Google Place ID rather than treated as identical truth.

**Direction-of-data-flow law:** Google content may be displayed live or held only under an explicit
permitted TTL. It must never populate, correct, enrich, or train the owned catalog, observations, or
taste fingerprint. Only the durable Place ID alias may cross that boundary. Every candidate-card
field carries provenance so mixed-provider facts cannot silently become this.is-owned data.

This layer now has a bounded, operator-confirmed acquisition implementation but no reviewed real run.
Until licensing evidence, a reconciled artifact, refresh, a reviewed populated alias registry, serving, and
real-group value are real, “vendor exit” is a plan—not an achieved property.

The first implementation boundary now lives in `v2/src/domain/openCatalog.ts`: a Firebase-free
normalizer with `o:{GERS}` identity, current `taxonomy.alternates`, bounded taxonomy, explicit
operating status, pinned release/schema/license-ledger provenance, paired source dataset/license, coordinate
validation, and a separate opaque Google Place ID alias. Its tests prove Google display/address/
rating fields cannot cross the normalizer. The explicit DuckDB runner and extraction policy apply exact
provenance/status/category/bbox/identity rejection reasons and create stable in-memory cell packs,
then a deterministic codec writes a no-overwrite, digest-addressed compact artifact. The runner is
network-confirmed, release/bbox/row/byte bounded, and locally tested without contacting Overture. The
source/serving architecture is chosen. The hashed, identity-free server alias contract and client-denial
rules exist, but no alias collection workflow or populated registry does; a reviewed real artifact,
alias population/query wiring, refresh, and serving remain unimplemented.
The repository-root `catalog:plan` command now strictly validates a Git-ignored release/license/
area/limit manifest without downloading or writing anything. It cannot authorize activation and
cannot call a planned manifest “extracted” without an artifact digest and reconciled row ledger.

The explicit-area source is separately bounded: `planAreaGazetteer.ts` parses only pinned GeoNames
populated-place rows, performs globally unbiased bounded text matching, and creates coordinates only
after an explicit named selection. `gazetteer:plan` validates the three source-file digests, CC BY
attribution evidence, parser/query/index ceilings, disabled activation, and—only for an indexed
claim—an artifact digest plus reconciled row ledger. It cannot download, write, index, deploy, or
enable search. A separate pure index policy now proves deterministic admin-table parsing, exact
nine-reason row reconciliation, duplicate handling, and raw-row/accepted-row/serialized-byte
ceilings over synthetic inputs. It can return only an in-memory result; no real download, artifact,
gazetteer index, endpoint, attribution surface, or UI exists yet.

The pure shortlist policy now lives in `v2/src/domain/openDiscovery.ts`. It accepts only normalized
open records and one bounded area carrying `provenance: explicit_plan`; no device, home, saved, or
inferred geography exists in its inputs. It rejects every status except `open`, maps the current Overture `basic_category` and taxonomy
hierarchy to Food/Drinks/Coffee/Activity, requires at least one current group-visible Want/Love
category signal, allows a different member's optional Quick start hint only as weak support, treats
missing members as unknown, excludes known/unsupported/out-of-area records, and returns at most
three with source labels. This proves the selection contract, not retrieval availability: there is
still no catalog download, index, service, or UI path feeding it real records.
Alcohol/nightlife (`drinks`) is excluded even when multiple members have visible history unless the
caller supplies the group's explicit sensitive-category opt-in; shared behavior is never treated as
consent. Religious, health/recovery, adult, and other unsupported categories do not map into the
launch shortlist at all.

### 2. Bounded live Google enrichment

Google remains the highest-coverage cold-start presentation source. Use it in two stages:

- **Retrieve once per active plan:** Nearby/Text Search with only the fields needed to identify and
  shortlist candidates. Never search separately for each member.
- **Enrich only the final three:** one current photo and, where the experiment budget permits, a
  live place/generative summary plus only the constraints required by this plan.

Google currently prices display name/type at Pro, rating/price/hours at Enterprise, and reviews,
editorial/generative summaries, good-for-groups/children, outdoor seating, and similar atmosphere
fields at Enterprise + Atmosphere. Asking for one high-tier field promotes the request to that tier.
Field masks are feature budgets, not implementation trivia.

Google generative summaries are supported in the US but are not guaranteed for every place. They
must display Google's required “Summarized with Gemini” disclosure and reporting affordance. They
are a live fallback, not permanent this.is copy.

One narrow photo-only proxy now exists locally behind two disabled controls: a client build flag and
an operator-owned server config. It never returns reusable Google URLs or keys, accepts only current
group candidates, counts media events without identities/place IDs, and preserves the material
fallback on denial. It does not perform Nearby/Text Search, descriptions, summaries, hours, ratings,
price, or unfamiliar candidate retrieval. Production use remains blocked until external quota,
key-restriction, telemetry, and reviewed-evidence steps are complete.

### 3. this.is-owned structured observations

After a save or visit, offer optional one-tap observations instead of a review form:

- good with family
- quiet enough to talk
- easy parking
- worth a drive
- casual / special occasion
- outdoors
- what to order (short text)
- one user-owned photo

Each observation has an author, timestamp, audience, and source. Conflicting observations remain
visible as disagreement; they are not averaged into fake certainty. Safety-critical claims such as
allergen safety or wheelchair accessibility require a verified source or multiple recent
confirmations and must show their source/date.

The existing private note now explicitly prompts for practical context such as what to order, when
the place works, or why the person would return. It remains private unless separately included in an
exact group share; the candidate excerpt is attributed and capped at 180 characters. This is a
member-authored note, not a provider description or public review.

The implemented structured slice uses seven non-safety-critical Yes/No observations. The containing save
or group projection supplies the author identity; each value carries its own timestamp, audience,
and `user_authored` source. Canonical values remain private, exact group sharing requires a separate
inclusion choice, and candidate cards prioritize visible attributed disagreement. User photos and
safety-critical observation types remain unimplemented.

The current group draft can use one of five of those observations as an optional practical need.
At least one attributed group-shared Yes is required, any attributed No excludes the place, and
missing evidence stays unknown. This filter runs after truthful place eligibility and before the
three-card cap; it does not create support, alter rank, or persist as taste. When a place qualifies,
the required observation is displayed first. This is deliberately limited to non-safety-critical
coordination such as quiet or easy parking and is not a verified accessibility or safety claim.
Area and need remain in-memory draft controls until someone explicitly confirms a Pick. At that
boundary, the server repeats both checks against current-version group projections and stores only
the normalized area text and allowlisted observation key on the temporary Pick. The private return
screen shows them; the public receipt, personal taste, and group defaults do not.

This layer is durable, cacheable, inexpensive, and progressively replaces Google atmosphere calls.

### 4. Trust-weighted taste evidence

Trust discovery means **people whose demonstrated taste overlaps yours**, not whoever is popular.
The first implementation uses explicit outcomes:

- Loved: strong positive taste evidence.
- Want: weak aspirational evidence; it cannot prove quality.
- Tried: visit evidence only; neutral unless accompanied by an observation.
- Not my taste: private negative learning signal; not a public place rating.
- Not for us: plan-specific veto; does not become a permanent personal judgment.

Implemented detail aggregation keeps that neutrality exact: a Tried member's explicitly group-shared
observation may enrich a candidate that Want/Loved evidence already made eligible, but it does not
increase support breadth, affect rank, reduce the unknown denominator, or make a place eligible alone.

For two people `a` and `b`, compute similarity only over places where both supplied usable taste
evidence. Shrink small overlaps toward zero:

```text
raw similarity = weighted cosine over Loved / Want / Not-my-taste outcomes
confidence      = sharedEvidenceCount / (sharedEvidenceCount + 8)
tasteTrust      = max(0, raw similarity) × confidence × freshness
```

The `+8` is an initial conservative prior, not a forever constant. A person with one shared café
cannot become a trusted recommender. Geographic and category normalization prevent two prolific
travelers from appearing similar merely because both save many restaurants.

Fingerprints use only owned/open taxonomy plus user-authored descriptors. Sensitive categories are
excluded by default and require per-group opt-in. Google `primaryType` must not become a durable
derived fingerprint feature.

For an unfamiliar candidate, aggregate positive outcomes from the nearest taste neighbors. Apply
these safeguards:

- No anonymous “people like you” explanation with fewer than three independent contributors.
- Never expose the contributors, their saved places, or their similarity score.
- Named evidence is allowed only for a current group member who shared that exact place.
- One member's explicit plan veto removes the candidate regardless of predicted score.
- New accounts, duplicate behavior, reciprocal boosting, and anomalous bursts contribute little or
  nothing until they establish independent history.
- Do not display fake precision such as “93% match.” Use plain evidence language.

Valid reasons include:

- “Vivian loved this.”
- “New to your family · fits your casual Korean pattern.”
- “People with taste like yours loved this.” (only after the privacy/confidence threshold)
- “Two family members want this; taste neighbors also liked it.”

## Ranking an adaptive shortlist

First eliminate candidates that violate explicit constraints or vetoes, or are closed/permanently
closed. Then score the remainder:

```text
40% member breadth        how many members have positive exact or predicted fit
25% weakest-member fit    fairness guard against optimizing for one enthusiast
20% trust evidence        confidence-shrunk taste-neighbor outcomes
10% context fit           occasion, type, and explicit constraints
 5% evidence freshness    recent confirmations beat stale assumptions
```

Exact known matches lead when they fit. New taste-fit candidates fill gaps. The result remains at
most three unnumbered choices; ranking is not exposed as a leaderboard.

These weights are a testable starting policy. A pilot must evaluate decision completion, veto rate,
and explanation trust before learned ranking can replace them.

## Cold start without forced creation

A new user can contribute nothing and still browse a group plan. Optional calibration should take
less than a minute:

1. Select broad categories and practical constraints, or skip.
2. Optionally react to up to six recognizable places near a chosen familiar area using Loved,
   Tried, Not my taste, or Skip.
3. Optionally share one or more places from Google Maps.

The app supplies current place images during this calibration within the same media budget. The
user is never asked to photograph or describe an unfamiliar business. Quick-start category choices
remain weak priors and cannot generate exact agreement claims.

## Photo strategy

The display priority is:

```text
recent user-owned photo
→ one budgeted live Google photo with attribution
→ licensed landmark/business image when provenance permits
→ designed amber material/poster fallback
```

User photos are optional and most useful after a real visit. They are not the cold-start plan. The
product should ask once—after saving or closing a Pick—not turn every user into a catalog worker.
Google photo names and media are never stored as owned assets.

## Cost shape

One cold-area plan should cause at most:

- one Nearby/Text Search request shared by the group;
- zero to three final-candidate detail/summary enrichments;
- zero to three photo-media requests.

Using Google's July 2026 list prices as an illustrative upper bound, 1,000 entirely cold plans in a
month would create about 1,000 Pro searches, 3,000 Enterprise + Atmosphere detail calls, and 3,000
photo-tier events. After current free caps, that is approximately $50 for rich details plus $14 for
photos; the searches remain within the current 5,000-event free cap. Actual billing must be verified
by SKU telemetry before launch and prices can change.

This plan math does not describe capture. Google's current Autocomplete session pricing promotes a
session-ending Pro-or-higher Details request to Enterprise + Atmosphere. Capture therefore ends with
an Essentials-only request; explicit final-candidate enrichment is the only intended E+A path.

Cost falls as this.is-owned observations and images cover repeated candidates. A project-wide
allowance, remote kill switch, and material fallbacks remain mandatory; client counters alone are
not a budget.

## Rollout order

1. Ship understandable top-three cards with deterministic category copy and a designed fallback;
   add one bounded live Google photo only after the project-wide allowance and kill switch exist.
2. Add adaptive attendee-aware retrieval and exact source labels without location targeting.
3. Add optional structured observations and user photos after saves/visits.
4. Build the private taste vector and evaluate similarity offline with synthetic and consented pilot
   data.
5. Enable anonymous taste-neighbor reasons only after density, privacy, abuse, and explanation tests
   pass.

The trust algorithm is a compounding advantage, not a launch dependency. Early this.is must remain
useful with Google/open catalog context plus the people already inside the group.
