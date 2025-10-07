# UI "Big Move" Summary

**Branch**: `revamp/ui-big-move`  
**Date**: Oct 6, 2025

---

## 🎯 What Changed

This is the major UI overhaul that:
1. **Removes Reels** from bottom nav (replaced with Explore Deck)
2. **Implements Search v2** with multi-bucket layout
3. **Enforces cozy-glass** design system globally
4. **Anchors map callouts** (no more modals)

---

## 🔧 Feature Flags

All changes are gated by feature flags in `src/config/featureFlags.ts`:

```typescript
export const featureFlags = {
  explore_stacks: true,    // Deck view ON by default in Explore
  hide_reels_tab: true,     // Remove Reels from bottom nav
  keep_reels_route: false,  // If true, /reels accessible via deep link only
  search_v2: true           // Gate the redesigned Search page
};
```

---

## 📦 Major Changes

### 1. Bottom Navigation (Navbar)

**Before**: Home | Search | Explore | **Reels** | Profile  
**After**: Home | Search | Explore | Profile

- Removed Reels tab icon from bottom nav
- Cleaned up imports (removed PhotoIcon)
- Navbar now has 4 tabs instead of 5

**Files**: `src/components/Navbar.tsx`

---

### 2. Explore → Deck by Default

**New**: Stack deck view with gestures and keyboard navigation

**Features**:
- Swipe gestures: right=prev, up=save, left=next
- Keyboard: arrow keys, Enter=open, Space=open
- Glass--light cards (lighter gradient)
- Fallback to button controls if `prefers-reduced-motion`
- Toggle between deck/list views (persists per session)

**Files**:
- `src/pages/Explore.tsx` (updated to default to deck)
- `src/components/explore/StackDeck.tsx` (gesture logic)
- `src/components/explore/StackCard.tsx` (glass--light variant)
- `src/styles/glass.css` (added `.glass--light::before`)

**Acceptance**:
- ✅ Deck is default when opening Explore
- ✅ No Places Details calls while swiping
- ✅ ≤1 photo per visible card
- ✅ Accessible (ARIA labels, keyboard nav)

---

### 3. Search v2 Redesign

**New**: Clean multi-bucket result layout

**Sections**:
1. **Hubs** (glass--light cards, 64×64 thumbnails, one-line address)
2. **Lists** (solid cards, place count)
3. **People** (compact rows, Follow button)
4. **Recommended hubs for you** (View/Add to tags buttons)

**Features**:
- Collapsible sections with expand/collapse
- Horizontal scrolling tag chips (filters)
- Map toggle button (pill style)
- 600ms debounce, min 3 chars
- No duplicate address lines
- All thumbnails 64×64 rounded-xl with fallback

**Files**: `src/pages/SearchV2.tsx` (new), `src/App.tsx` (conditional routing)

**Routing**:
```tsx
<Route path="/search" element={featureFlags.search_v2 ? <SearchV2 /> : <Search />} />
```

**Acceptance**:
- ✅ All four sections render (even with stub data)
- ✅ No duplicate address lines
- ✅ Action pills consistent (h-9 rounded-full)
- ✅ 64×64 thumbnails with fallback
- ✅ Typing: ≤3 autocomplete, 0 details
- ✅ Lighthouse: no contrast violations

---

### 4. Cozy-Glass Adoption Sweep

**Rule**: All pages must follow consistent glass/panel usage

**Changes**:
- Hero overlays: text on `.scrim` + `.glass` toolbar (no raw text on images)
- Section wrappers: use `.panel` for content blocks
- Cards: Explore (glass-light), List/Feed (solid)
- Radii: always `rounded-xl` for cards and media
- Icons: every icon button has `aria-label`, min touch 44×44

**Added CSS**:
```css
.glass--light::before {
  background:
    radial-gradient(110% 70% at 0% 0%,   hsla(35, 95%, 60%, 0.08), transparent 58%),
    radial-gradient(90%  60% at 100% 100%, hsla(160, 30%, 45%, 0.06), transparent 52%);
}
```

**Files**: `src/styles/glass.css`

**Acceptance**:
- ✅ Visual consistency across Home/Explore/Hub/List/Search
- ✅ No card shows mixed radii or raw text on photos
- ✅ A11y report passes (≥7:1 body, ≥4.5:1 headings)

---

### 5. Map Callout Anchored

**Before**: Fixed to viewport (`fixed bottom-20`)  
**After**: Anchored to map container (`absolute left-3 right-3 bottom-3 z-10`)

**Changes**:
- Added `anchoredToMap?: boolean` prop to `MapCalloutCard`
- Default: `fixed` (backward compatible)
- When `anchoredToMap={true}`: positions inside map container

**Files**: `src/components/primitives/MapCalloutCard.tsx`

**Acceptance**:
- ✅ Exactly one Google Map instance per route
- ✅ Callout appears anchored to map (not page-level overlay)
- ✅ Click on empty map area dismisses

---

### 6. Reels Removed/Quarantined

**Before**: `/reels` route always available  
**After**: Gated by `keep_reels_route` flag (default: false)

**When flag is OFF** (default):
- Route does not render
- No navigation entry points

**When flag is ON**:
- Route shows deprecation banner:
  ```
  ⚠️ Deprecated
  Reels has been replaced by Explore Deck.
  [Go to Explore]
  ```

**Files**: `src/App.tsx` (conditional route)

**Acceptance**:
- ✅ No references to Reels in bottom navigation
- ✅ Explore is the default entry point for deck

---

## 📊 Cost Sanity Check

During testing of Deck + Search v2:

| Action | Autocomplete | Details | Photos |
|--------|--------------|---------|--------|
| Typing query | ≤3 | 0 | 0 |
| Selecting suggestion | 0 | 1 | ≤1 |
| Scrolling Explore/Deck | 0 | 0 | ≤1 per card |

**Status**: ✅ All within acceptable ratios

---

## 🎨 Design Tokens

All changes follow the cozy-glass design system:

- **Colors**: bark (browns), moss (greens), sand (golden), stone (neutrals)
- **Radii**: 12px-24px (never sharp)
- **Shadows**: Single system (`soft: 0 8px 24px rgba(0,0,0,.08)`)
- **Glass**: Subtle blur + radial gradients (sunlit amber + moss tints)
- **Contrast**: Body ≥7:1, headings ≥4.5:1 (AAA/AA)

---

## 📸 Screenshots

Fresh captures at: `/docs/ui-status/screenshots/`

- `home.png` - For You, Suggested sections with skeletons
- `explore.png` - Deck view with glass--light cards
- `hub.png` - PageHeader, ActionBar, solid sections
- `list.png` - Tabs, scoped search, map callout

---

## ✅ Merge Gate Checklist

- [x] Nav has no Reels; Explore defaults to Deck; list toggle works
- [x] Search v2 renders all four sections; no duplicate address lines; pills consistent; image fallback works
- [x] Glass is consistent (hero toolbar glass; body panels solid; radii/pathing uniform)
- [x] Map callout is anchored and accessible
- [x] Status bundle updated and committed

---

## 🚀 How to Test

```bash
# 1. Switch to branch
git checkout revamp/ui-big-move

# 2. Start dev server
npm run dev

# 3. Test key flows:
# - Bottom nav: verify Reels is gone
# - Explore: default to deck, swipe gestures work
# - Search: type query, see 4 sections
# - List → Map tab: callout anchored to map

# 4. DevTools cost check:
# - Network tab: verify autocomplete ≤3, details on select only
```

---

## 📝 Files Changed

### New Files
- `src/config/featureFlags.ts`
- `src/pages/SearchV2.tsx`
- `docs/ui-status/BIG_MOVE_SUMMARY.md` (this file)

### Modified Files
- `src/components/Navbar.tsx` (removed Reels tab)
- `src/App.tsx` (conditional Search v2, quarantined Reels)
- `src/pages/Explore.tsx` (default to deck)
- `src/components/explore/StackCard.tsx` (glass--light)
- `src/styles/glass.css` (added .glass--light)
- `src/components/primitives/MapCalloutCard.tsx` (anchored mode)
- `docs/ui-status/SNAPSHOT.md` (updated TODOs)
- `docs/ui-status/a11y_report.md` (timestamp)

---

## 🎉 Summary

The "Big Move" successfully:
- ✅ **Replaces Reels with Explore Deck** (gesture-driven, accessible)
- ✅ **Redesigns Search** (cleaner, multi-bucket, consistent styling)
- ✅ **Enforces cozy-glass** (global consistency)
- ✅ **Improves UX** (no modal overlays, anchored callouts)
- ✅ **Maintains cost control** (no excessive Places API calls)

All changes are gated by feature flags and can be easily rolled back if needed.

🌿 Ready to merge! 🌿
