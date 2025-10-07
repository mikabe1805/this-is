# UI Revamp Progress

**Phase:** A - Foundation (Tokens + Primitives)  
**Branch:** `revamp/ui-cozy-glass`

## Design System Status

### Tokens ✅
- [x] Color palette (bark, moss, sand, stone)
- [x] Border radius (lg: 12px, xl: 16px, 2xl: 24px)
- [x] Shadows (soft, inset)
- [x] Focus states (moss-500 outline)

### Primitives ✅
- [x] CardShell (solid/glass variants)
- [x] PageHeader (with cover image + glass toolbar)
- [x] ActionBar (sticky bottom with primary/secondary actions)

### Glass Utilities ✅
- [x] `.panel` - Opaque warm cards
- [x] `.glass` - Translucent glass effect
- [x] `.scrim` - Dark gradient for images
- [x] `:focus-visible` - Accessible focus rings

## Page Refactoring Status

### Home (`/`)
- [x] Uses CardShell for sections
- [x] No inline hex colors
- [x] Consistent token usage
- [ ] Screenshot captured

**Sections:**
- [x] Popular Nearby
- [x] Trending Tags
- [x] Lists You Might Like
- [x] New From Following

**Screenshot:**
![Home](./screenshots/home-mobile.png)

---

### Explore (`/explore`)
- [x] Segmented control (Nearby | Following | Discover)
- [x] CardShell glass cards for list view
- [x] Inline actions (like, save, share, add post)
- [x] View toggle button (deck mode ready)
- [ ] Screenshot captured

**Screenshot:**
![Explore](./screenshots/explore-mobile.png)

---

### PlaceHub (`/place/:id`)
- [x] PageHeader with cover + glass toolbar
- [x] Tabs (Overview | Posts)
- [x] ActionBar (Save primary, Add Post, Directions secondary)
- [x] CardShell for all content cards
- [x] Consistent token usage
- [ ] Screenshot captured

**Screenshot:**
![PlaceHub](./screenshots/hub-mobile.png)

---

### ListView (`/list/:id`)
- [x] PageHeader with cover
- [x] Tabs (Overview | Places | Posts | Map)
- [x] ActionBar with primary actions
- [x] Glass cards for overlays
- [x] Consistent token usage
- [ ] Screenshot captured

**Screenshot:**
![ListView](./screenshots/list-mobile.png)

---

## Accessibility Checklist

- [x] All icon-only buttons have `aria-label`
- [x] Focus rings visible (moss-500, 2px solid, 2px offset)
- [x] Keyboard navigation (Tab, Enter, Escape, Arrows)
- [x] Color contrast ≥ 4.5:1 (headings)
- [x] Color contrast ≥ 7:1 (body text)
- [x] Autocomplete dropdowns keyboard accessible

## Color Token Usage

### Primary Colors
- `bark-*` - Warm browns (backgrounds, text)
- `moss-*` - Earthy greens (accents, buttons, focus)
- `sand-*` - Warm golds (highlights)
- `stone-*` - Neutral grays (borders, muted text)

### Usage Patterns
```tsx
// Buttons
className="bg-moss-500 hover:bg-moss-600 text-white"

// Cards
className="bg-bark-50 border-bark-200"

// Text
className="text-bark-900" // Headings
className="text-bark-700" // Body
className="text-bark-500" // Muted

// Tags
className="bg-moss-100 text-moss-700 border-moss-200"
```

## Next Phase (B) - Advanced UI

- [ ] Deck view for Explore (StackDeck component)
- [ ] Page transition animations
- [ ] Lazy-loading images with IntersectionObserver
- [ ] Skeleton loading states
- [ ] Static Map images (replace interactive maps where possible)
- [ ] Photo optimization (blur placeholders, progressive loading)

---

**Last Updated:** [AUTO-GENERATED]

