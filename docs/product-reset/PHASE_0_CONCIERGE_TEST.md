# Phase 0 — the cheapest test of the core bet

**Status:** adopted with corrections after Codex review (Claude proposal, July 12 2026)  
**Runs with:** zero additional app engineering. Local group mechanics exist, but no deployment,
Google-compliance fix, production photo budget, migration, or external app pilot is required.  
**Gates:** whether it is worth funding the remaining compliance, migration, discovery, and app-based
[`VALIDATION_PLAN.md`](VALIDATION_PLAN.md) (Phase A) / [`GROUP_VALIDATION_PLAN.md`](GROUP_VALIDATION_PLAN.md) (Phase B) work.

## Why this exists

The Phase A and Phase B plans are strong, but both are **gated on a reviewed external application**.
The attendee-aware group loop and no-install receipt now exist locally; production rules, pair
migration, Google place-data storage/attribution compliance, project-wide photo budgets, and reviewed
pilot evidence do not. Phase 0 therefore tests the thesis before those remaining costs are paid.

That ordering has the risk backwards. The project's own accepted findings already say the two
riskiest things are **unproven**, and neither one requires the app to test:

1. *"Real-group usefulness is UNPROVEN"* (`CURRENT_STATE.md`).
2. *"Cold plan #1 has no defined win over Maps/chat/assistants"* (`CLAUDE_STRESS_TEST_RESPONSE.md`).

Phase 0 tests those two things **by hand, this week**, with a human as the recommendation engine. If
the value isn't there for even a well-chosen established group, no UI, ruleset, or catalog fixes it —
and the team saves the multi-week group-foundation + compliance build. If the value *is* there,
Phase 0 produces exactly the evidence that justifies paying for the rest.

> Phase 0 is a **kill test for the thesis**, run before the expensive build — not a usability test of
> the UI. Usability is Phase A/B's job.

## The three assumptions, ranked by risk × cost-to-test

| # | Assumption the whole product rests on | If false… | Cheapest way to test |
|---|---|---|---|
| A | When a real group faces a real "where do we go" decision, an **overlap-of-tastes answer beats their default** (group chat + "the usual" + Maps). | The product has no reason to exist. | Hand-built "3 places, real reasons" at a real decision. No app. |
| B | People will **keep logging** Want/Tried/Loved (+notes) over time **without gamification**. | The graph never compounds; the app is empty forever. | A dead-simple capture channel for 2 weeks; measure unprompted logging + decay. No app. |
| C | The **2nd..Nth person contributes**, so it isn't a single-organizer tool. | "Group-native" collapses to one person's list. | Organizer-concentration in the same 2-week run. No app. |

Assumption B is the likely operational failure mode: **voluntary, un-gamified logging may decay hard**
once novelty fades. Claude's original examples were not independently sourced in this handoff, so
they are not adopted as evidence. Phase 0 measures the risk directly instead of laundering a market
analogy into product truth.

## Tier 0 — Retrospective Overlap Replay (1 day, 3 groups)

The fastest possible read on Assumption A. No waiting, no logging period.

**Protocol**
1. Recruit **3 established recurring groups** (2–6 people who already decide where to go together
   ≥2×/month and use a group chat). No one who has worked on this.is. **Recruit on decision cadence,
   not on willingness to log** — screening for "people who'll keep a taste diary" selects for the
   enthusiast this test is trying to look past, and turns a pass into a mirage. Frame it to recruits as
   "we help your group decide," never "log your places."
2. With explicit research consent, interview each member **separately, ~15 min**: their real Want /
   Tried / Loved places + one-line reasons. Capture in a temporary access-controlled worksheet; this
   is the taste graph by hand. Do not place raw history in the aggregate evidence file.
3. Compute the overlap by hand using the *actual* `groupRecommendation` contract
   (`v2/src/domain/groupRecommendation.ts`): explicit context filter → hard veto → support breadth →
   Want/Love strength → freshness; cap at 3; unknowns stay unknown; reasons in the real forms ("All 5 want
   this," "Dev loved this; 4 haven't weighed in").
4. Show the group two things, together:
   - **Replay:** "For your last 2–3 outings, here is what this method would have said."
   - **Live:** "For your next real outing, here are 3 places with reasons."
5. Watch and ask (don't teach): would you have gone here? Is this better than how you actually
   decided? What's wrong/surprising? Which reason felt true vs. hollow?

**Kill / proceed (directional, n=3)**
- **Kill or hard-narrow the thesis** if, for established groups with real shared history, the
  hand-built answer is *not* felt to beat their default in **at least 2 of 3** groups. If it can't win
  with a perfect human engine and rich history, the software won't win with a cold graph.
- **Proceed to Tier 1** if ≥2 of 3 groups say the answer was materially better/faster and name a
  reason that felt true.

## Tier 1 — Two-Week Concierge (14 days, 5 groups incl. 1 pair control)

Tests Assumptions A, B, and C in the wild, still with **no app**.

**Setup**
- 4 established groups of 3–6 + 1 pair as smallest-group control (mirrors Phase B cohort logic).
- **Seed recall from what already exists — do not make people rebuild a list from memory.** After
  consent, a member may choose to use an existing Google/Apple Maps saved list as a recall prompt.
  Saved is not Want, starred is not Loved, and list membership grants no sharing permission. The
  operator transcribes only places the participant individually confirms with a label, explicit
  Want/Tried/Loved state, and private/group audience; optional reasons remain separately consented.
  Unconfirmed rows are omitted, silence stays unknown, and the participant may skip the list entirely.
  Any source screenshot is deleted immediately after readback confirmation. This tests whether
  existing recall can create useful starting density; it does not test or authorize bulk import and
  does not claim the product should ship one. If a member confirms nothing, they start empty and
  honestly "haven't weighed in."
- Then give each group the **lowest-friction top-up channel you can stand up in an hour**: a shared
  Google Form, a Telegram/WhatsApp bot, or literally "text this number the place + want/tried/loved
  + one line." Pick whichever the group already lives in. The channel is disposable; it is not the
  product.
- The facilitator is the engine: you receive saves, and when a group asks "where should we go," you
  hand back 3 places with reasons using the real contract above — within a believable time (minutes,
  like a friend would).

**Rules of the run**
- **No engagement nudges** beyond one neutral day-7 check-in. Un-prompted behavior is the whole point.
- Seed confirmations are setup density, not logging behavior. Week 1 begins only after every member
  has completed or skipped the seed step. `week1UnpromptedSaves` and `week2UnpromptedSaves` count only
  new participant-initiated top-ups after setup; facilitator transcription, seed confirmations,
  edits/retries, and responses caused by the day-7 check-in do not count. Organizer concentration uses
  those top-ups plus genuine plan asks, never setup labor. A group clears the directional logging-
  survival screen only when Week 1 is nonzero, Week 2 is nonzero, and Week 2 retains at least 25% of
  Week 1. This low bar detects hard collapse; it does not establish healthy long-term retention.
- Log only bounded research metrics (below). **Never store raw notes or place histories** in the
  research log; delete the raw capture channel's contents at the end. Get explicit consent up front.
  This mirrors the project's privacy-minimal ethos.

**Measures (map to existing thresholds where possible)**
| Signal | What it answers | Directional bar |
|---|---|---|
| Unprompted logging rate (new post-setup saves/week) & week-1→week-2 decay | Assumption B | Week 1 > 0, Week 2 > 0, and Week 2 ≥25% of Week 1 for ≥3 of 5 groups |
| Organizer concentration (share of saves+asks by top member) | Assumption C | ≤80% for ≥3 of 5 groups (mirrors Phase B) |
| Real decisions where the group used the concierge answer | Assumption A | ≥1 genuine plan resolved from the answer in ≥3 of 5 groups |
| "Beats default" verdict at day-14 interview | Assumption A | ≥3 of 5 groups would choose it again over chat/Maps |
| Plan #2 without a reminder | retention | ≥2 of 5 groups start a second real plan unprompted |

**Day-14 interview** — reuse the Phase A prompts (`VALIDATION_PLAN.md`), especially:
*"When would you open this instead of the group chat or Maps?"* and *"If it disappeared tomorrow, what
would you miss?"* Interview members separately before the group.

## Executable decision gate

Before contacting anyone, complete the operator card in `PILOT_OPERATOR_KIT.md` and require:

```bash
npm run pilot:preflight
```

This command must remain blocked while the ignored local readiness file is absent or incomplete. It
does not create consent or authorize collection by itself.

Record only anonymous aggregate observations in `phase0-evidence.local.json` using
`phase0-evidence.template.json`, then run:

```bash
npm run phase0:decision -- --evidence phase0-evidence.local.json
```

The evaluator rejects names, contact details, notes, places, and unknown fields. It emits cohort
counts and gates only; anonymous group codes never appear in its output. The local evidence file is
Git-ignored and is not created until observations are real.

- **Proceed to finish the group foundation + Phase A/B** only if Tier 0 passes *and* Tier 1 clears
  logging-survival, ≥3/5 "beats default," and ≥1 real resolved plan in a majority. Now the expensive
  build (rules, compliance, catalog, projections) is justified by evidence.
- **Narrow the wedge** (established-history groups only; drop "usable with zero history" as a launch
  claim) if the answer wins only when history is rich — consistent with Phase B's "narrow the wedge"
  rule.
- **Revise the thesis / re-home the product** if logging collapses or groups prefer a fresh chat poll.
  The most likely re-home, if this fires, is *inside the chat* (a bot/receipt) rather than a standalone
  app — see the moat/distribution finding in the coordination log.
- **Stop** for any privacy failure, coerced participation, or fabricated evidence.

## What Phase 0 does NOT prove (honest boundary)

- Whether the *software's* low friction (vs. a human concierge) matters — that's the real UX bet, and
  it's Phase A/B's job.
- Whether the graph compounds over *months*, not weeks.
- Privacy, authorization, and cost at scale.
- Anything about the specific visual design (Codex's pass) — Phase 0 is deliberately app-agnostic so a
  weak UI can't mask a strong loop or vice versa.

Phase 0 answers one question only: **is there a there there** — cheaply, before the bill comes due.

> **Retention horizon caveat.** 14 days shows the mechanic works *once*. The signal that actually
> separates this from the decision-app graveyard is **an unprompted 2nd and 3rd plan after the operator
> goes silent**, and **days-between-plans** — which only appear over **60–90 days**. Treat single-session
> success as necessary-but-insufficient, and note that the North Star ("resolved Picks per group per
> month") is structurally uninstrumented in the real app: routing hands off to Google (no return signal)
> and Pick-closure is manual self-report. In the concierge run the operator observes the outcome
> directly, which is *better* evidence than the app will have — plan the app's instrumentation accordingly.

## Constraints honored

Use [`PILOT_OPERATOR_KIT.md`](PILOT_OPERATOR_KIT.md) for the blocked-until-reviewed recruitment copy,
consent briefing, separated research surfaces, facilitator prompts, incident stop card, and deletion
closeout. This protocol defines the experiment; the operator kit defines safe execution.

- **No gamification** — Phase 0 measures *organic* logging precisely because gamification is off the
  table. That is the point, not a workaround.
- **Group-native** — cohort is established 3–6 groups with a pair control, not a pair-first test.
- **Privacy-minimal** — consent, bounded metrics only, raw taste data deleted after the run.
