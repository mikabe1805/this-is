# Pilot operator kit

**Status:** execution-ready research draft; participant use is blocked until every bracketed owner
field below is completed and the participant-facing language is reviewed. This is not legal advice
and does not replace an applicable consent, privacy, or compensation review.

Use this kit with [`PHASE_0_CONCIERGE_TEST.md`](PHASE_0_CONCIERGE_TEST.md) for the app-free thesis test
and [`GROUP_VALIDATION_PLAN.md`](GROUP_VALIDATION_PLAN.md) for the later private app pilot. The evidence
templates and evaluators remain authoritative for thresholds. This document controls how the operator
recruits, briefs, observes, separates data, and deletes temporary research material.

> **Owner decision, July 14:** personal development dogfooding with the owner's own family is not an
> external research study and is not blocked by this kit. It may continue without a readiness card as
> long as nobody records it as independent participant evidence or uses it to claim production/legal
> readiness. This kit becomes mandatory only before recruiting or systematically studying people
> outside that personal development context.

## 0. Owner handoff — start with one kill-test, not an app pilot

**Current truth:** the local product and its development fixtures can support further engineering
review, but no real group has yet shown that this.is beats its ordinary chat, Maps, or assistant
workflow. Participant contact, a private app pilot, and production cutover are not approved.

The next move is only **Phase 0, Tier 0**: three established recurring groups, interviewed separately,
followed by one hand-built truthful shortlist for a real decision. It tests whether the central answer
has value before anyone funds more discovery, migration, compliance, or app-pilot work. Do not start
Tier 1, Phase A, Phase B, recruitment for the app, or deployment at the same time.

### Decisions only the owner or named reviewer can make

Before participant contact, the owner must supply and genuinely review:

1. the participant-facing operator identity and durable withdrawal contact;
2. the research, withdrawal, and raw-data deletion dates;
3. compensation terms, including an explicit decision to offer none;
4. the temporary capture system, its access roles, deletion owner, and rehearsed deletion path;
5. the participant briefing and recruitment message in this kit; and
6. the incident/withdrawal owner and approval to contact adults under these boundaries.

These are governance facts, not product copy. Codex or another agent may check their consistency but
must never invent or approve them. Do not place participant names, contacts, places, notes, group
labels, or observations in the readiness card.

### Smallest honest execution ladder

1. Copy `pilot-operator-readiness.template.json` to the Git-ignored
   `pilot-operator-readiness.local.json`; replace every placeholder only with reviewed facts.
2. Run `npm run pilot:preflight`. Stop while it fails.
3. Recruit the three Tier 0 groups using the cadence-based screener below—never by geography or
   enthusiasm for logging.
4. Run only the Tier 0 protocol in `PHASE_0_CONCIERGE_TEST.md`, including separate interviews,
   participant readback, explicit audience choice, and the incident stop rule.
5. Put only the bounded anonymous outcomes in `phase0-evidence.local.json`, then run
   `npm run phase0:decision -- --evidence phase0-evidence.local.json` without editing observations to
   improve the result.
6. Stop or hard-narrow if fewer than two of three groups find the answer materially better and name a
   truthful reason, or if any privacy failure occurs. Only a genuine Tier 0 pass permits scheduling
   the five-group Tier 1 concierge run.
7. Only the full Phase 0 gate—not a good interview, screenshot, local test, or preflight pass—can
   justify finishing the external app-pilot foundation described in `GROUP_VALIDATION_PLAN.md`.

| State | What may happen next |
|---|---|
| Readiness card absent or failing | Local preparation and engineering verification only |
| Preflight passes | Contact the three Tier 0 groups under the reviewed briefing |
| Tier 0 passes with zero privacy failures | Schedule Tier 1; do not claim app validation |
| Full Phase 0 passes | Owner may fund the remaining foundation and reviewed app pilot |
| Any trust failure | Stop the affected work and invoke the incident card |

## 1. Do not recruit until this readiness card is complete

- [ ] Operator/legal identity: **[REQUIRED — do not infer]**
- [ ] Participant contact for questions or withdrawal: **[REQUIRED]**
- [ ] Research window and final raw-data deletion date: **[REQUIRED]**
- [ ] Compensation and payment handling, including “none”: **[REQUIRED]**
- [ ] Access-controlled temporary capture surface and access list: **[REQUIRED]**
- [ ] Participant-facing language reviewed by: **[REQUIRED OWNER/REVIEWER]**
- [ ] Incident and withdrawal owner: **[REQUIRED]**
- [ ] All participants are adults; minors are excluded from the first pilot.
- [ ] No production database, passive location, contact upload, private chat history, or background
  Google enrichment will be used.
- [ ] The operator can delete every temporary capture surface and has rehearsed the deletion log.

If any box is open, preparation may continue but participant contact and data collection may not.

### Executable pre-contact check

Copy `pilot-operator-readiness.template.json` to the Git-ignored
`pilot-operator-readiness.local.json`, complete it only after the reviews above are real, then run:

```bash
npm run pilot:preflight
```

The preflight rejects placeholders, unexpected fields, missing exclusion confirmations, an unrehearsed
deletion path, future review claims, and inconsistent research/withdrawal/deletion dates. It reports
field names only and never echoes the operator identity or contact. A pass confirms that the readiness
card is mechanically complete; it is not legal advice, consent, recruitment, or pilot evidence. Never
put participant names, contacts, places, notes, group codes, or observations in this file.

## 2. Recruitment without enthusiast bias

### Screener

Recruit the group, not an individual “power user.” A circle qualifies only when:

1. it contains 2–6 adults who already make place decisions together at least twice per month;
2. it already uses some ordinary coordination method such as chat, Maps, or “the usual”;
3. at least two members can participate independently; and
4. nobody has worked on this.is.

Do not screen on willingness to keep a diary, number of Maps saves, city, neighborhood, cuisine,
technical comfort, or enthusiasm for recommendation apps. Record only the bounded cohort fields in
the relevant evidence template after consent; do not copy screener conversation into evidence.

### Initial message

> I’m helping test a private way for recurring groups to make a real “where should we go?” decision.
> We’re looking for groups of 2–6 adults who already decide where to go together at least twice a
> month. This is research, not a public launch. Participation is voluntary. It may involve a short
> separate conversation with each person and one real group decision. Place preferences can be
> sensitive, so the operator will explain exactly what is temporarily collected, who can see it, and
> when it is deleted before anyone agrees. Interested groups can contact **[CONTACT]** by **[DATE]**.

Do not advertise “AI recommendations,” compatibility scores, effortless consensus, or access to
Google location history. Do not promise that the app is production-ready.

## 3. Consent briefing — read before collecting taste

Read this separately to each participant and allow questions. Record only `consentConfirmed: true|false`
in the temporary consent roster; never place a signature, name, contact, or recording in an aggregate
evidence file.

> **Who and why.** **[OPERATOR IDENTITY]** is studying whether explicit place preferences can help an
> existing group make a real place decision. This is research for this.is, not a public service.
>
> **What we ask for.** We may temporarily collect places you want to try, tried, or loved; an optional
> short reason; your responses during the decision; and whether the method helped. For scheduling, we
> keep your name/contact in a separate roster. In the later app pilot, the app also stores the account,
> group membership, sharing choices, Picks, and bounded product events described in its reviewed
> participant notice.
>
> **What we do not collect.** We do not request live or background location, contact uploads, private
> chat history, Google location history, or passwords. We do not treat missing preferences as agreement.
>
> **Who sees it.** Temporary raw place material is limited to **[ACCESS LIST/ROLE]**. Group-visible
> reasons may reveal that you Wanted or Loved a place only when you explicitly agreed to share that
> evidence for this research decision. Scheduling identity is kept separate from aggregate results.
>
> **Sensitivity and social risk.** Place taste can suggest routines, relationships, religion, health,
> alcohol use, or other sensitive facts. A reason or attributed pass may also create disagreement in a
> small group. You may skip any place, note, question, or decision without explanation.
>
> **Retention.** Raw taste capture and the scheduling roster will be deleted by **[DATE]**. The retained
> research result contains bounded coded outcomes only—not names, contacts, places, notes, chat,
> queries, tokens, screenshots, or raw vetoes.
>
> **Choice.** Participation is voluntary. You may stop or ask for deletion before **[WITHDRAWAL
> DEADLINE/CONTACT]** without affecting the rest of the group. Compensation is **[TERMS OR NONE]**.
> Do you understand this and choose to participate?

No response, group pressure, an organizer answering for others, or continuing to talk is not consent.
If one member declines, exclude their evidence completely; do not summarize it as unknown or negative.

## 4. Three strictly separated research surfaces

### A. Scheduling and consent roster — delete

Access: operator only. Suggested fields:

`circleCode | participantCode | name/contact | adultConfirmed | consentConfirmed | consentAt | withdrawalRequested`

Use random local codes such as `G01` and `P01`; do not derive them from initials, phone numbers, account
IDs, or group names. This surface never enters Git or an evaluator.

### B. Temporary taste workspace — delete

Access: only the reviewed research role. Suggested fields:

`circleCode | participantCode | placeLabel | want|tried|loved | optionalReason | explicitlyGroupVisible`

This is the only surface that may contain place labels or reasons. Do not add precise coordinates,
home/work labels, private chat excerpts, provider screenshots beyond the minimum needed to transcribe
the participant’s explicit choice, or inferred traits. Delete source screenshots immediately after
participant confirmation; delete the workspace on the reviewed deadline.

### C. Aggregate evidence — retain locally for review

Use only `phase0-evidence.local.json` or `group-pilot-evidence.local.json`. Their evaluators reject
identity, place history, notes, chat, queries, tokens, and unexpected fields. Never weaken the schemas
to make an observation fit. If a meaningful event cannot be represented, describe the schema question
without participant detail and review it before changing anything.

## 5. Tier 0 facilitator card — retrospective replay

### Separate 15-minute interview

Ask without examples first:

1. “Think about places this group might genuinely choose. Which do you Want, Tried, or Love?”
2. “Is there one short reason you would be comfortable sharing with this group?”
3. “Is each item private to the operator or permitted in this group decision?”
4. “Is there any candidate you would explicitly pass on for this plan?” Preview that a pass is
   attributed before recording it.

Read back every transcription. The participant—not the operator—confirms label, state, optional reason,
and audience. Do not turn “I guess,” silence, proximity, a screenshot folder, ratings, or visit history
into preference.

### Group decision

Present no more than three unnumbered candidates. For each, state the strongest true reason and exact
unknown count. Then remain silent long enough for ordinary disagreement to appear.

Ask after the decision:

- “What did that reason actually mean to you?”
- “What felt true, hollow, surprising, or socially awkward?”
- “Was this materially better than how you made the comparable decision?”
- “Would you use this answer for the real plan? Why or why not?”

Do not explain the intended answer, sell the product, rescue confusion, or count politeness as value.

## 6. Tier 1 / Phase B fidelity card

- Give no engagement nudges beyond the one allowed neutral check-in.
- Record a plan only when the group had a genuine decision opportunity.
- Keep facilitator response time, candidate cap, and explanation style consistent across circles.
- For the four cold comparisons, preassign two `ordinary → this.is` and two `this.is → ordinary`
  orders before sessions begin; do not change order after seeing a group’s preferences.
- Interview members separately before group debrief whenever the protocol requests comprehension,
  acceptability, or “beats default.”
- A meaningful action must be performed by the participant; watching the organizer does not count.
- A Maps saved list may be a participant-chosen recall prompt only. Never convert saved/starred state
  into Want/Loved, and never treat a screenshot or facilitator transcription as an unprompted save.
  The participant confirms each retained place, state, audience, and optional reason; seed confirmations
  are setup density and remain outside week-1/week-2 logging and organizer-concentration measures.
- A guest is one unnamed unknown, never an inferred supporter or participant account.
- A Pick handed to Maps is not “resolved” until the bounded protocol outcome says it was used for a
  genuine plan. Manual closure is evidence only when voluntarily supplied.
- Record facilitator repair when the operator had to explain sharing, attribution, evidence mode, or
  recovery. Do not silently correct the UI and mark comprehension true.

## 7. Incident and stop card

Stop the affected session immediately for any:

- unauthorized read or unexpected audience;
- private place/note disclosure;
- false consensus or missing data counted as support;
- pass attribution that surprises the actor;
- coerced participation or organizer answering for another member;
- accidental capture of location history, contacts, private chat, credentials, or a minor’s data; or
- inability to honor withdrawal or deletion.

Then: contain access, preserve no extra participant material “for debugging,” notify **[INCIDENT
OWNER]**, honor deletion/withdrawal first, and record only the corresponding bounded failure flag.
Do not resume that circle until the owner reviews the failure. Any trust failure forces the evaluator’s
stop outcome; never relabel it to preserve a proceed threshold.

## 8. Deletion closeout

Maintain an identity-free deletion log outside the evidence JSON:

`surfaceCode | requiredDeletionAt | deletedAt | deletionMethod | operatorInitials | exceptionReviewed`

At closeout:

1. delete source screenshots, forms/messages used as raw capture, exports, local copies, trash, and
   access links;
2. delete the scheduling/consent roster after the withdrawal window;
3. verify aggregate evidence contains no identity, contact, place, note, chat, query, token, screenshot,
   raw veto, or exact action log;
4. run the applicable evaluator without editing observations to satisfy thresholds; and
5. have **[REVIEWER]** confirm deletion and the decision output before any product or cutover claim.

Template values, screenshots of empty forms, planned dates, and facilitator memory are not evidence.
