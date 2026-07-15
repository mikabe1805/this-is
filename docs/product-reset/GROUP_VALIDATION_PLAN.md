# Group-native validation plan — Phase B

**Status:** protocol and anonymous evaluator implemented locally; no observations collected  
**Phase A:** [`VALIDATION_PLAN.md`](VALIDATION_PLAN.md) tests the already-built two-person core only

## Question

Does accumulated, permissioned taste evidence help a real recurring group reach a trusted place
decision better than its ordinary chat/Maps/assistant behavior—and does the product distribute value
beyond one organizer?

Phase A pair evidence may justify building this pilot. It cannot answer this question or satisfy the
production product gate.

## Cohort and duration

- Eight recurring circles: six established groups of 3–6 and two pairs as the smallest-group control.
- Recruit by decision cadence, not geography: each circle already makes at least two place decisions
  per month and uses a group chat.
- At least two family groups, two friend/dinner groups, and two groups with visibly divergent taste.
- Run for 21 days or two genuine plan opportunities per group, whichever is longer; do not fabricate
  a second plan merely to complete the protocol.
- Do not include minors in the first group pilot. A minors/guardian policy is required before they
  become a supported family-group participant.

## Phase B journeys

### A. Cold first-plan comparison

For four groups with no imported this.is history, observe one authentic decision using their ordinary
method and one comparable decision using this.is. Counterbalance order where practical. Do not ask
them to recreate private chat history.

Record only bounded outcomes: time to acceptable shortlist, whether a decision occurred, objections,
confidence in the explanation, and which method the group would choose next time. This is formative,
not a statistically powered experiment.

### B. Standing-memory plan

For every group:

1. Members establish identity and sharing consent without facilitator repair.
2. At least two attendees contribute independent evidence; quick-start priors do not count.
3. The plan names who is attending and optional Food/Drinks/Coffee context; it does not require or
   infer a location profile.
4. Members explain each known-match or new taste-fit reason in their own words.
5. Any pass/veto previews and then displays attribution exactly as promised.
6. The group chooses, shares the Pick receipt into its existing chat, and optionally closes the Pick.
7. Observe whether a second genuine plan begins without a reminder.

## Group-shaped health measures

- **North star:** resolved genuine plans per active group per month.
- **Plan #2 rate:** groups that begin a second genuine plan without facilitator prompting.
- **Multiplayer ratio:** groups where at least two attendees take a meaningful action.
- **Organizer concentration:** share of group actions performed by the most active member.
- **Attendee acceptability:** every attendee may accept the chosen place even when it was not their
  first choice; disagreement is recorded, not averaged away.
- **Reason comprehension:** members distinguish exact shared evidence from predicted taste fit.
- **Chat bridge:** Pick receipt is successfully returned to the existing group chat and understood by
  a member who did not operate this.is.
- **Privacy/trust:** false consensus, unexpected named evidence, fingerprint inference, veto surprise,
  unauthorized access, and failed revocation.

## Proceed thresholds

These are directional thresholds for eight formative groups:

| Test | Proceed threshold |
|---|---:|
| Group joins and understands sharing without facilitator repair | 6 of 8 |
| At least two attendees participate meaningfully | 6 of 8 |
| Group reaches an acceptable candidate from truthful evidence | 5 of 8 |
| Group resolves a genuine plan | 5 of 8 |
| Pick receipt is used and understood in the existing chat | 5 of 8 |
| Group begins a second genuine plan without a reminder | 4 of 8 |
| Cold groups prefer this.is or consider it materially additive vs ordinary method | 3 of 4 |
| Members correctly distinguish known match from taste-fit | 80% |
| Created Picks close within 21 days | 60% |
| Organizer performs more than 80% of actions | no more than 2 groups |
| False consensus, private disclosure, veto-attribution surprise, unauthorized read | 0 |

## Decision rules

- **Proceed to a group private preview** only when every threshold passes and derived-data deletion,
  membership revocation, server retrieval, and Google compliance are independently verified.
- **Iterate activation** when consent is understood but too few members contribute or return.
- **Iterate decision UX** when groups participate but cannot finish a real plan.
- **Narrow the wedge** to established-history groups when cold plan #1 consistently loses to Maps,
  chat, or assistants.
- **Review the thesis** when groups prefer a fresh chat poll or the product degenerates into a
  single-organizer tool.
- **Stop immediately** for any unauthorized read, private-data disclosure, false consensus, or veto
  behavior that surprises the person who used it.

## Instrumentation boundary

Before recruiting or collecting participant material, complete and review
[`PILOT_OPERATOR_KIT.md`](PILOT_OPERATOR_KIT.md). It supplies the participant-facing briefing,
identity/taste/evidence separation, facilitator fidelity card, incident stop rule, and deletion log;
bracketed operator fields are blockers, never implied values.

Do not reuse pair denominators. The implemented `group-pilot:decision` evaluator emits group-level aggregates only and must
not expose group IDs, member IDs, place history, chat content, notes, queries, invite tokens, or raw
vetoes. `group-pilot-evidence.template.json` uses anonymous circle codes, size bands, bounded cohort
types, action-share bands, booleans, and anonymous member comprehension/acceptability observations.
The Admin summary now emits group Pick conversion and 21-day closure counts without IDs. Cutover
evidence schema v3 requires the hashed eight-circle Phase B result and zero trust failures. No value
in either template is evidence until a real consented observation and review occurs.
