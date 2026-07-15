> **HISTORICAL V1 AUDIT - NOT CURRENT PRODUCT AUTHORITY.** This file analyzes the retired root application. Preserve it as evidence, but do not use its goals, backlog, architecture, styling, or completion claims for canonical v2 work. See the repository documentation map at `docs/README.md`.

# Known bugs — UX refresh branch

Captured during the Phase-7 sweep. To be fixed in a follow-up session
(functional bugs, not UX direction).

## High priority

### 1. Profile photo upload doesn't save (EditProfile)
- **Surface**: `src/pages/EditProfile.tsx`, the camera button overlay on the avatar
- **Symptom**: tapping the change-photo button doesn't open a file picker, and even if it did the change wouldn't persist.
- **Suspected cause**: the camera button has no `onClick` handler wired (`<button className="absolute -bottom-1 -right-1 ...">` is purely decorative). Need to wire it to a hidden file input → `firebaseStorageService.uploadAvatar(...)` → `firebaseDataService.updateUserProfile(...)`. The storage service is already imported elsewhere; just needs hookup here.

### 2. List image upload broken on creation (CreateListModal / SaveModal "New list" flow)
- **Surface**: `src/components/CreateListModal.tsx` and the "New list" branch inside `src/components/SaveModal.tsx`.
- **Symptom**: there's no image-picker control at all on the new-list form. The Profile lists page renders the cover image with a `<img src={list.coverImage} ...>` — when no image was uploaded, that resolves to undefined and the browser shows the broken-image icon.
- **Two fixes needed**:
  - Add a cover-image upload step to the create-list flow (single optional file field).
  - Render a guard in [src/pages/Profile.tsx](src/pages/Profile.tsx) so `<img>` either has a real `src` or falls back to a `<PlacePoster>` / colored block. (Same fix should hit ListView and any other surface that renders `list.coverImage` directly.)

### 3. EditListModal renders behind ListModal (z-index ordering)
- **Surface**: `src/components/EditListModal.tsx` mounts at z-50 while `src/components/ListModal.tsx` mounts higher.
- **Fix**: `EditListModal` needs a higher `z-[10020]` (matching CreateHubModal's stacking), or it needs to render via `createPortal` outside the modal stack so its z-index isn't bound by the parent's stacking context.

## Medium priority

### 4. SaveModal save flow has a duplicate-list confirm UX issue
- The `window.confirm()` overwrite prompt is jarring inside the new modal aesthetic. Consider replacing with a small inline warning + an explicit "Overwrite" button.

### 5. Some legacy dropdowns (UserMenuDropdown, ListMenuDropdown) still use the legacy palette
- The alias palette tones them but they haven't had a focused styling pass.

## Notes on out-of-scope-but-flagged

- **Image-budget gating**: photos were previously dark on PlaceHub because `VITE_PLACES_PHOTOS_ENABLED` defaulted to `false`. That's now `true` in `.env.local` but worth noting — if you ever ship to a production env with the flag flipped off, hubs go dark again.
- **Profile body comments form**: the form posts to `firebaseDataService.postProfileComment` and refetches via `getProfileComments`. There's a 100ms `setTimeout` race that masks the success path and could lose comments under load. Worth replacing with a real callback chain.
