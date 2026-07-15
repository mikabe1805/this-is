# Canonical this.is v2 instructions

This directory is the product and implementation authority. Root `src/` is frozen v1 reference; do not import from it or restore its feed, hubs, public influence, rankings, demo follows, or generic discovery thesis.

## Product contract

- Promise: **find the place your people already agree on.**
- Atomic evidence: person × place × Want/Tried/Loved × optional note.
- Primary navigation: Together / Keep / People.
- Primary object: an explicit private recurring group of 2–6 people; a pair is the smallest group.
- Decision surface: at most three unnumbered candidates with short, true reasons.
- Closed loop: signal → group evidence → Pick → visit → Tried/Loved → stronger memory.
- Missing data is unknown, never consensus. Do not fabricate cold-start people, places, votes, notes, or signals.

## Commands

```bash
npm run dev
npm run runtime:check # from the repository root
npm test
npm run typecheck
npm run build
npm run docs:check # from the repository root
```

From the repository root, the same default commands delegate here.

## Data and safety

- `invites` are tokenized and read-only on open; connection requires explicit acceptance.
- `connections` are a retiring two-person foundation. A trusted, explicit migration converts an
  accepted pair into the same-audience two-member group; migrated markers no longer grant legacy reads.
- `saves` are owner-written and remain the canonical personal record.
- Group documents and current permission-version signal projections have member-only reads and
  trusted create/invite/accept/share/leave endpoints; clients cannot write them. The first explicit
  share locks membership. Group Picks preserve an attendee subset and server-derived reason; only
  attendees can close them. Their server-rendered public receipt exposes no group identity, notes, or
  raw evidence and is revoked on membership change. Deeper taste adaptation, migration, and guest
  attendance remain required.
- Do not build home-area profiles, device-location targeting, geofences, or silent geographic ranking.
  Explicit meeting geography, if a person supplies it, is ephemeral logistics and never taste evidence.
- Current `picks` preserve immutable pair/group membership, place evidence, and reason. The migration
  converts historical pair Picks, but legacy invite/overlap/plan route removal remains required.
- Preserve Google Places minimal fields, autocomplete sessions, caching, photo budget, and explicit-details-only behavior.
- Development fixtures must remain behind `import.meta.env.DEV` and must be absent from production bundles. Use `/together?prototype=group` for the approved group-native UX proof.

## Deployment

Do not deploy hosting, functions, indexes, or rules from this directory. Follow [`../docs/product-reset/CUTOVER.md`](../docs/product-reset/CUTOVER.md); root `npm run cutover:check` intentionally blocks known unsafe production state.
