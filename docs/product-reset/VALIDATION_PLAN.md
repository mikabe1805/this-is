# Real-pair validation plan

> **Phase A scope, July 12:** this protocol tests the existing two-person core: accumulated taste,
> invite consent, truthful reasons, and Pick closure. A pair is the smallest group, so this evidence
> can justify or stop further group investment, but it cannot approve production groups. Group
> production additionally requires [`GROUP_VALIDATION_PLAN.md`](GROUP_VALIDATION_PLAN.md). The
> existing pair evaluator and cutover evidence remain Phase A-only until the group protocol receives
> its own privacy-minimal executable schema.

**Question:** does this.is help two real people reach a trusted place decision from history they already created?

This pilot validates the shared core, not visual preference or feature demand. Do not add group
features, imports, AI prose, rankings, or voting to inflate **Phase A** numbers.

## Cohort

- Recruit **eight existing pairs** who already ask each other where to go. A read at five to seven
  pairs is useful for diagnosing obvious activation or trust failures, but it cannot satisfy the
  absolute 7-of-8, 6-of-8, and 5-of-8 proceed thresholds below.
- Include at least two pairs with sparse shared taste, two with substantial overlap, and two whose preferences often diverge.
- Avoid pairs where both people worked on this.is or need the facilitator to explain the product.
- Run for **14 days**, long enough for an invitation, ordinary saving, one real plan, and a post-visit update.

## Facilitated first session

Observe; do not teach beyond handing one person the URL.

1. Person A signs in, keeps three real places, and creates an invitation.
2. Person B opens it and narrates what they think will happen before tapping anything.
3. Person B establishes identity, keeps at least one real place, and explicitly connects.
4. The pair opens Together and describes the evidence in their own words.
5. They use Make a plan for an actual upcoming outing or explain why no current context is real.

Record task completion, elapsed time, facilitator interventions, mistaken expectations, candidate objections, and any moment that feels invasive or falsely certain. Do not record private notes or place histories in the research log.

## Unfacilitated period

- Ask pairs to use this.is only when a genuine place recommendation or plan arises.
- Do not send engagement reminders beyond one neutral day-7 check-in.
- At day 14, interview each person separately before interviewing the pair together.

## Behavioral funnel

The app writes only aggregate, owner-scoped, client-unreadable milestones:

```text
onboarding_completed
  → signal_saved
  → invite_created
  → connection_accepted
  → pair_opened
  → plan_viewed
  → pick_created
  → pick_closed (visited | dismissed)
```

Allowed event properties are counts, generic plan context, terminal status, and Want/Tried/Loved. Events cannot contain a place id, note, query, invite token, name, or other-person identifier. Every event carries a rules-bounded 30-day expiry; `v2/firestore.indexes.json` enables TTL and exempts the sequential expiry field from indexing. Use `npm run pilot:summary -- --since YYYY-MM-DD` with Admin credentials to produce aggregate counts; the command rejects expired or malformed events and never prints user ids or raw events. Firestore TTL is asynchronous, so expired records can remain briefly even though the summary stops counting them immediately.

The same Admin-only report derives pair outcomes from existing `connections` and `picks` rather than adding a relationship identifier to telemetry. For connections created on or after `--since`, it reports connected pairs, pairs with a Pick, Pick conversion, open/visited/dismissed Picks, pair closure, and the percentage of Picks closed within 14 days. Pair keys exist only in process memory and never appear in output.

The report does **not** pretend to measure invite comprehension, whether a candidate felt truthful, whether someone could explain a reason, trust failures, or unprompted return. Those remain observation/interview measures in the research log. The event counts diagnose where activity occurred; the connection/Pick aggregates evaluate the durable decision loop.

## Evidence workflow

Use anonymous pair codes only. Do not put names, contact details, notes, place histories, queries,
invite tokens, or free-text interview content into the machine-readable observation file.

1. Copy [`PILOT_OBSERVATIONS.template.json`](PILOT_OBSERVATIONS.template.json) to a filename ending
   in `.pilot-private.json`. That suffix is ignored by Git.
2. Add one `P01` through `P08` record per pair. Each member contributes only the bounded
   `reasonExplained` observation; pair-level fields record the remaining qualitative gates.
3. Produce the identity-free Admin aggregate:

   ```bash
   npm run pilot:summary -- --since YYYY-MM-DD > pilot-summary.pilot-private.json
   ```

4. Evaluate the written protocol:

   ```bash
   npm run pilot:decision -- \
     --observations pilot-observations.pilot-private.json \
     --summary pilot-summary.pilot-private.json
   ```

The evaluator rejects extra fields, non-anonymous pair codes, private notes, impossible aggregate
rates, duplicate pairs, or a cohort larger than eight. Its output contains only aggregate metrics,
gate results, and one protocol recommendation:

- `continue_pilot` before all eight pair records exist;
- `stop_rollout` after any observed false consensus or private disclosure;
- `proceed_private_preview` only when every written threshold passes;
- `iterate_activation` when consent comprehension passes but one or more completion gates fail;
- `review_thesis` when a complete cohort does not understand the promise. Interview evidence still
  determines whether that review becomes a thesis revision; the tool does not manufacture that
  qualitative conclusion.

## Success thresholds

| Test | Proceed threshold |
|---|---:|
| Recipient correctly predicts invite visibility and consent | 7 of 8 |
| Pair connects without facilitator repair | 6 of 8 |
| Pair reaches at least one candidate both consider truthful | 5 of 8 |
| Pair creates a Pick for a real decision | 4 of 8 |
| Created Picks close as visited or dismissed within 14 days | 60% |
| Person can explain the displayed reason from visible signals | 80% |
| Observed false-consensus or private-data disclosure | 0 |
| At least one member returns without a reminder | 4 of 8 pairs |

These are directional thresholds for a small formative pilot, not statistical claims.

Report mapping:

- `pairOutcomes.connectedPairs` is the cohort denominator for pairs connected since the pilot start.
- `pairOutcomes.pairsWithPick` and `pairPickRatePercent` support the real-decision threshold.
- `pairOutcomes.closureWithin14DaysRatePercent` is the direct measure for the 60% closure threshold.
- `visited`, `dismissed`, and `selectedOpen` explain the closure result without exposing which pair produced it.
- All comprehension, usefulness, explanation, trust, and return thresholds require the dated observation/interview record.

## Interview prompts

Ask without naming intended features:

1. What did you think this.is was for before connecting? What do you think now?
2. Which place, if any, felt like a useful answer? What evidence made it believable?
3. What did the app claim that you did not agree with?
4. When would you open this instead of the group chat or Google Maps?
5. What would you hesitate to save because the other person could see it?
6. Did three choices feel relieving, restrictive, or arbitrary?
7. What happened after you picked somewhere?
8. If this disappeared tomorrow, what—if anything—would you miss?

## Decision rules

- **Proceed to a private preview** when consent comprehension, unassisted connection, truthful-candidate usefulness, and zero trust failures meet threshold.
- **Iterate the activation loop** when people understand the promise but cannot create enough evidence or reach a candidate.
- **Revise the thesis** when pairs consistently treat it only as a personal save utility, prefer starting a new vote, or cannot distinguish its answer from ordinary Maps lists.
- **Stop the rollout immediately** for any unauthorized read, false consensus presented as fact, or instrumentation containing prohibited identifiers.

The pilot is complete only when the aggregate evaluator output, separately stored interview
findings, and the human decision are appended to this document or a linked dated report. Never
commit the filled `.pilot-private.json` inputs.
