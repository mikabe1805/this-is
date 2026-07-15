# Separate clean-room v2 — final extraction audit

**Inspected:** July 11, 2026  
**Path:** `C:\Users\mikus\this-is-v2`  
**Decision:** no implementation should be merged into canonical `this-is/v2`.

## State observed

- The separate folder is a Git repository whose latest recorded commit is `5e5656f` (July 3, 2026).
- It contains extensive uncommitted work across UI, hooks, functions, styles, tests, and product documents, plus untracked personalization and vision files.
- Because that work is dirty and exists outside the active repository, it must not be moved, deleted, reset, or archived automatically.

## Unique material reviewed

| Material | Decision | Reason |
|---|---|---|
| Home, boards, pins, vibe onboarding, editorial illustrations | Do not extract | Implements the superseded EMBERBOARD/personal-catalog thesis. |
| Board/pin owner-import script | Do not extract | Writes a data model deleted by the pair-signal pivot. |
| Search/Places Cloud Functions | Do not extract now | Reintroduces a server surface before the canonical client cost contract and function inventory are settled. |
| Cache-first service worker | Reject | Can pin stale HTML/API responses and complicate rollback during an active cutover. |
| JavaScript swipe-back hook | Reject | Competes with native browser navigation and does not prove accessibility or nested-scroll safety. |
| Smoke and visual-computed tests | Concept already retained | Route rendering, console errors, mobile geometry, deep links, and production fixtures now have stronger canonical checks. The tests themselves target deleted routes and onboarding. |
| Icons and manifest | Recreate, do not copy | Copy describes the obsolete personal-save promise and light palette. Canonical v2 now has a convergence icon and current product description. |

## Archive recommendation

The folder has historical value but no remaining extraction dependency. The owner should first preserve its dirty work—preferably by committing it on an `archive/clean-room-v2` branch or creating a read-only zip—then move it outside the active development path. Until that explicit preservation choice is made, the root cutover status correctly reports it as an unresolved version-authority blocker.

## Reproducible preservation manifest

`npm run archive:plan` is a read-only planner for this decision. It executes only the Git
`branch`, `ls-files`, `rev-parse`, and `status` commands, hashes non-ignored files, records tracked
deletions, and prints JSON to stdout. It has no filesystem write API and does not stage, commit,
move, bundle, zip, delete, or archive anything.

The July 11 run recorded:

- branch `master`, base commit `5e5656f4083393087e05e65e3b032d6acef4d41b`;
- 31 modified files, one tracked deletion, and 14 untracked files;
- 83 tracked/untracked non-ignored files totaling 2,330,489 bytes;
- `.env.local` present but explicitly neither read nor hashed;
- generated `dist`, `node_modules`, and `test-results` directories present but excluded by Git's
  ignore boundary;
- identical `git status --porcelain=v1` output before and after the run.

To capture a reviewable manifest without touching the external folder:

```bash
npm run archive:plan > external-v2-manifest.pilot-private.json
```

The `.pilot-private.json` suffix keeps the local manifest out of Git. This plan does not replace
owner approval for the actual preservation method.
