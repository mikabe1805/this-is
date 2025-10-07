# UI Status Snapshot

*Last updated: Oct 6, 2025, 09:12 PM EDT*

---

## 📸 What Changed

### Design System
- **Color Palette**: Earthy browns (bark), moss greens, sand, stone with accent moss-500
- **Glass Effects**: Soft glassmorphism with radial gradients (sunlit warmth + subtle moss tint)
- **Shadows**: Single shadow system (`soft`: 0 8px 24px rgba(0,0,0,.08))
- **Border Radius**: Consistent rounded corners (lg: 12px, xl: 16px, 2xl: 24px)

### Primitive Components
- **CardShell**: `solid` (panel) and `glass` variants with consistent padding
- **PageHeader**: Cover image with `.scrim` gradient + glass toolbar overlay
- **ActionBar**: Fixed bottom bar with primary/secondary actions, safe-area insets

### Page-Level Changes
- **Home**: Uses CardShell (solid) for all sections; no text on photos
- **Explore**: Glass cards with inline actions; segmented controls
- **Hub**: PageHeader with glass toolbar; solid panel sections; ActionBar with Save/Add Post/Directions
- **List**: PageHeader; scoped search; tabs (Overview/Places/Posts/Map); ActionBar

---

## 🔴 Known Regressions

*None reported yet.*

---

## ✅ Open TODOs

### Page Implementation Status

#### Home (`/`)
- [x] Uses CardShell primitives
- [x] No inline hex colors
- [x] All sections use solid variant
- [x] Text not directly on photos

#### Explore (`/explore`)
- [x] Uses CardShell (glass variant)
- [x] Segmented control for Nearby/Following/Discover
- [ ] Stack deck view (behind feature flag `explore_stacks`)
- [x] Inline actions on cards

#### Hub (`/hub/:id`)
- [x] PageHeader with cover image + scrim + glass toolbar
- [x] ActionBar with Save (primary), Add Post + Directions (secondary)
- [x] Solid panel sections for About/Tags/Lists/Posts
- [x] All icon buttons have aria-label
- [ ] Add skeleton loaders for hero and first section

#### List (`/list/:id`)
- [x] PageHeader with cover image
- [ ] Scoped SearchBar ("Search within this list…") with 400ms debounce
- [ ] Tabs: Overview | Places | Posts | Map
- [ ] Map tab with glass CalloutCard
- [x] ActionBar with proper positioning
- [ ] Empty states for each tab

---

## 📊 Screenshots

**Status**: ✅ 4 screenshots captured

See `/docs/ui-status/screenshots/` for visual reference:

- `explore.png` - Explore page (Nearby tab, glass cards)
- `home.png` - Home feed (Popular Nearby, Trending Tags, Lists You Might Like)
- `hub.png` - Hub detail page (PageHeader, ActionBar, solid sections)
- `list.png` - List view page (PageHeader, search, place cards)

---

---

---

---

---

---

---

## 🎨 Design Principles

### Cozy, Usable, Pretty
- **Warm & Inviting**: Earth tones (bark, sand) with sunlit glass effects
- **Visual Clarity**: No clutter; consistent spacing; clear hierarchy
- **Soft Shadows**: Single shadow style; no harsh edges
- **Liquid Glass**: Subtle blur + radial gradients; not overly transparent
- **Accessible**: High contrast for body (≥7:1); headings (≥4.5:1); focus rings on all interactive elements

### Reference Inspiration
Based on attached designs:
- Rounded corners everywhere (never sharp)
- Soft, warm lighting (golden/amber tints)
- Card-based layouts with breathing room
- Subtle depth (shadows, not borders)
- Clean typography hierarchy

---

## 🔧 Developer Quick Reference

### Using Primitives

```tsx
// Card container
<CardShell variant="solid" className="p-4">
  {/* Content */}
</CardShell>

// Page hero
<PageHeader 
  coverUrl="/path/to/image.jpg"
  title="Place Name"
  subtitle="123 Main St"
  rightActions={<button>...</button>}
/>

// Bottom actions
<ActionBar
  primary={<button className="w-full bg-moss-500 text-white py-3 rounded-xl">Save</button>}
  secondary={[
    <button key="post">Add Post</button>,
    <button key="dir">Directions</button>
  ]}
/>
```

### Color Usage

```tsx
// Background
className="bg-bark-50"

// Text
className="text-bark-900"      // Body (high contrast)
className="text-bark-700"      // Secondary
className="text-bark-500"      // Tertiary

// Accent
className="bg-moss-500 text-white"  // Primary action
className="text-moss-600"           // Links

// Glass effect
className="glass p-3 rounded-xl"
```

### Accessibility

- Every icon button MUST have `aria-label`
- Focus rings: `:focus-visible` with 2px moss-500 outline
- Contrast: body ≥7:1, headings ≥4.5:1
- No text directly on images (use .scrim or move text below)

---

## 🧪 Testing Checklist

- [ ] Screenshot all 4 pages (mobile viewport 375x812)
- [ ] Lighthouse audit (no contrast violations)
- [ ] Verify no inline hex colors in changed files
- [ ] Verify all primitives use design tokens
- [ ] Check aria-labels on icon buttons
- [ ] Test keyboard navigation (focus rings visible)
- [ ] Verify skeleton loaders on slow connections

---

*This document is auto-updated by `npm run status:ui`*

