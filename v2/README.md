# this.is v2

The rebuild. Personal-first, Pinterest-like place discovery: one-tap save to boards, a feed
where images are the ranking UI, and going places is what makes your boards more beautiful.
**Success metric: Been-per-Want conversion, not save count.**

- Blueprint: `../MAKEOVER.md` (product architecture stands; its EMBERBOARD/Candlewax visual
  direction was rejected — v2 has its own language, see `DESIGN.md`).
- Governance, laws, cut order, ship gates: `CLAUDE.md` in this folder.
- New-repo posture: this folder imports nothing from the v1 tree and can be lifted out
  wholesale. Same Firebase project; v1 keeps serving until cutover.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 — env comes from the repo-root .env.local
npm run build      # typecheck + production build (entry gate: <150kB gzip)
```

## Status — Weeks 1–3

| Piece | State |
|---|---|
| Shell renders before auth, lazy Firebase, persistent Firestore cache | ✅ W1 |
| One-code-path save (`savePin`) + undo/re-file/status + save toast | ✅ W1 |
| Add flow (Google autocomplete lane, session tokens, 1-tap save) | ✅ W1 |
| Saved: boards grid, WANT/BEEN, `BEEN TO X OF Y` | ✅ W1 |
| Board page, closeup (details-on-tap, photo+attribution, related) | ✅ W1 |
| Board-picker sheet (route-backed, hardware-back closes) | ✅ W1 |
| Default-deny rules draft (`firestore.rules`, not deployed) | ✅ W1 |
| Owner-import script (`scripts/import-owner-saves.mjs`) | ✅ W1 |
| Global-first: device-language + coord-biased Places | ✅ W1 |
| TONIGHT rail — go-now from your saves, real dusk, mood chips, GO hand-off | ✅ W2 |
| Morning-after card — converts last night's GO into a Been | ✅ W2 |
| Honest-hours seam (`lib/hours.ts`) + `getHours` callable (`functions/`, ready-to-deploy) | ✅ W2 |
| Home feed — transparent ranking, every card prints its top factor as its reason | ✅ W3 |
| Search v1 — in-browser minisearch, browse grid, guided chips, matched labels | ✅ W3 |
| Onboarding — vibe picker (seeds taste) + feed-the-machine + first-run routing | ✅ W3 |
| Anti-hoarding set, share links, asset batch, PWA hardening | W4 |

The feed ranking is `score = taste·3 + proximity·4 + freshness·1 + dormant·1 − diversity·1`
([data/ranking.ts](src/data/ranking.ts)) — weights in one const, every ranked card carries its
top-scoring factor as a ≤6-word italic reason ("because you save wine bars" / "8 min away" /
"you saved this in March"). Discovery from the city candidate pool (`data/candidates.ts`) lights
up when a composer or the `--city` import seeds it; until then the feed is honestly your-saves-only
and the thin-feed line says so.

**Hours are off until the callable ships.** Deploy `functions/getHours` and set
`VITE_HOURS_ENABLED=true` to light up open/closed claims; until then TONIGHT shows walk time only
(honest absence, by design).

## Verify

```bash
npm run build   # tsc + vite; entry gate <150kB gzip (currently ~84kB)
```
Pure logic is covered by headless assertion suites (bundle with esbuild, run under node):
W2 (dusk, TONIGHT gating, morning-after ripening) 18/18; W3 (taste vector, ranking factors +
reason lines) 16/16.
