# v2 functions

> **HISTORICAL - DO NOT DEPLOY.** This directory belongs to the retired TONIGHT/open-hours pivot
> and is not referenced by `firebase.v2.json`. The canonical minimal backend is
> [`../../v2-functions/`](../../v2-functions/). Do not run the deployment commands below.

Deliberately small server surface. **Week 2 ships one callable: `getHours`.**

## Status

`getHours` is written and ready to deploy but **not live**. Until it is deployed *and* the client
flag `VITE_HOURS_ENABLED=true` is set in the repo-root `.env.local`, the app makes no hours call
and the TONIGHT rail shows **no open-now claim** — walk time only. This is the blueprint's honest
fallback ("if the callable slips the schedule, ship with no open-now claim at all"), not a bug.

## Deploy

```bash
cd v2/functions
npm install
# Set the IP-restricted server key as a secret (NOT the client VITE_ key):
firebase functions:secrets:set GOOGLE_PLACES_NEW_KEY
npm run deploy
```

Then flip `VITE_HOURS_ENABLED=true` and rebuild the client.

## Contract

`getHours({ placeIds: string[] })` → `{ [g:pid]: { openNow, closesAt?, likely? } }`. Auth
required. Serves a fresh (<24h) `places/{id}.hoursCache` when present, else fetches Google
`currentOpeningHours` server-side and writes the cache back. Places it can't resolve are omitted —
the client treats missing as **unknown**, never as closed.

## Deferred (W3–W4)

`onPinWrite` (taste vector, counters, candidate pool) · `onSharedBoardWrite` (share baker) · the
monitored daily job (coords refresh, candidate prune, taste decay).
