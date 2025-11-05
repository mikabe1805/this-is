# UI Design System

This document outlines the design system and best practices for maintaining UI consistency across the application.

## 🎨 Color Palette

### Primary Colors
- **Sage** (`sage-*`) - Primary brand color, use for primary actions and key UI elements
  - Primary: `sage-600` (#4A614A)
  - Hover: `sage-700` (#3D4F3D)
  - Active: `sage-800` (#334033)

- **Linen** (`linen-*`) - Neutral backgrounds and borders
  - Background: `linen-50` (#FAF8F4)
  - Borders: `linen-200` (#ECE7DE)
  - Hover states: `linen-100` (#F5F3EE)

- **Charcoal** (`charcoal-*`) - Text colors
  - Primary text: `charcoal-800` (#333333)
  - Secondary text: `charcoal-700` (#3D3D3D)
  - Muted text: `charcoal-500` (#5F5F5F)

### Accent Colors
- **Warm** (`warm-*`) - Love/favorite actions (peachy coral tone)
- **Earth** (`earth-*`) - Secondary brand color (warm brown tone)
- **Gold** (`gold-*`) - Highlights and special callouts
- **Coral** (`coral-*`) - Alerts and errors
- **Cherry** (`cherry-*`) - Delete/remove actions

### Supporting Colors
- **Wood** (`wood-*`) - Rich browns for warmth
- **Cream** (`cream-*`) - Soft backgrounds
- **Almond** (`almond-*`) - Warm neutrals
- **Peach** (`peach-*`) - Soft accents
- **Terracotta** (`terracotta-*`) - Earthy accents

### Semantic Color Tokens (CSS Variables)
Use these for maximum flexibility:
```css
--surface: #FAF8F4      /* linen-50 */
--surface-2: #FFFFFF    /* white */
--border: #ECE7DE       /* linen-200 */
--text: #3D3D3D         /* charcoal-700 */
--muted: #6B7280        /* slate-500 */
--primary: #4A614A      /* sage-600 */
--primary-strong: #3D4F3D /* sage-700 */
--accent: #C9A94B       /* gold-400 */
```

Utility classes: `.bg-surface`, `.bg-surface-2`, `.text-muted`, `.text-primary`, `.border-token`

---

## 📐 Border Radius

**Hierarchy** (use consistently):
- **Cards/Containers**: `rounded-xl` (1.25rem)
- **Modals**: `rounded-2xl` (1.5rem) - for the "cozy" feel
- **Buttons/Pills**: `rounded-full` (9999px)
- **Inner elements**: `rounded-lg` (0.75rem)
- **Inputs**: `rounded-lg` (0.75rem)

**Custom radii**:
- `rounded-scrapbook` (1.5rem)
- `rounded-sticker` (2rem)
- `rounded-pill` (9999px)

---

## 🌟 Shadows

Use custom shadows for botanical aesthetic:

- **`shadow-soft`** - Subtle, everyday elements (2px, 7% opacity)
- **`shadow-cozy`** - Cards with mild elevation (4px, 10% opacity)
- **`shadow-botanical`** - **Default for cards** (8px, 10% opacity) ✨
- **`shadow-liquid`** - Hover states, floating elements (12px, 15% opacity)
- **`shadow-crystal`** - Modals, popovers (8px, 10% opacity)
- **`shadow-frosted`** - Light, airy elements (4px, 6% opacity)

**Best practice**: Use `shadow-botanical` as default for all cards and containers.

---

## 🔤 Typography

### Font Families
- **Serif**: `DM Serif Display` - Headings, titles
- **Sans**: `Inter` - Body text, UI elements
- **Display**: `Playfair Display` - Special display text
- **Handwriting**: `Caveat` - Decorative elements

### Type Scale Utilities (Recommended)
Always use these utility classes for consistency:

- **`.type-title`** - Large headings (1.125rem → 1.25rem)
- **`.type-subtitle`** - Subheadings (1rem → 1.05rem)
- **`.type-body`** - Body text (0.95rem)
- **`.type-caption`** - Small text, metadata (0.8125rem)
- **`.type-label`** - Form labels (0.875rem, font-medium)

### Cozy Variants
- `.text-cozy-title` - Cozy heading style
- `.text-cozy-sub` - Cozy subheading
- `.text-cozy-meta` - Cozy metadata

**Avoid**: Using arbitrary text sizes like `text-sm`, `text-base` directly. Use type scale utilities instead.

---

## 🧱 Components

### Button Component
**Location**: `src/components/Button.tsx`

**Usage**:
```tsx
import Button from './components/Button'

<Button variant="primary" size="md">Save</Button>
<Button variant="secondary" icon={<Icon />}>Cancel</Button>
<Button variant="danger" fullWidth>Delete</Button>
```

**Variants**:
- `primary` - Main actions (sage-600 background)
- `secondary` - Secondary actions (white background, border)
- `ghost` - Tertiary actions (transparent)
- `dark` - Dark backgrounds (charcoal-700)
- `danger` - Destructive actions (coral-500)
- `success` - Success actions (sage-500)

**Sizes**: `sm`, `md` (default), `lg`

**Props**:
- `icon` - Add icon to button
- `iconPosition` - `'left'` (default) or `'right'`
- `fullWidth` - Stretch to container width

---

### Card Component
**Location**: `src/components/Card.tsx`

**Usage**:
```tsx
import Card from './components/Card'

<Card shadow="botanical" padding="md" interactive>
  Content here
</Card>
```

**Props**:
- `shadow` - `'none'`, `'soft'`, `'cozy'`, `'botanical'` (default), `'crystal'`
- `padding` - `'none'` (default), `'sm'`, `'md'`, `'lg'`
- `interactive` - Adds hover effects
- `as` - Render as different element (default: `'div'`)

**Utility Classes**:
- `.card-standard` - Standard card styling
- `.card-interactive` - Interactive card with hover effects
- `.cozy-card` - Rounded-2xl card with botanical aesthetic

---

### Modal Component
**Location**: `src/components/Modal.tsx`

**Usage**:
```tsx
import Modal from './components/Modal'

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Edit Profile"
  size="md"
  footer={<Button>Save Changes</Button>}
>
  Modal content here
</Modal>
```

**Props**:
- `size` - `'sm'`, `'md'` (default), `'lg'`, `'xl'`, `'full'`
- `showCloseButton` - Show X button (default: `true`)
- `closeOnOverlayClick` - Close when clicking backdrop (default: `true`)
- `title` - Modal header title
- `footer` - Footer content (actions, buttons)

**Features**:
- Auto body scroll lock
- ESC key to close
- Focus trap
- Accessible (ARIA labels)

---

### Input Component
**Location**: `src/components/Input.tsx`

**Usage**:
```tsx
import Input from './components/Input'

<Input
  label="Email"
  type="email"
  placeholder="Enter your email"
  error={errors.email}
  icon={<EmailIcon />}
/>
```

**Props**:
- `label` - Input label
- `error` - Error message (shows in red)
- `helperText` - Helper text below input
- `icon` - Icon element
- `iconPosition` - `'left'` (default) or `'right'`
- `fullWidth` - Stretch to container (default: `true`)

---

### Section Component
**Location**: `src/components/Section.tsx`

**Usage**:
```tsx
import Section from './components/Section'

<Section title="My Lists" action={<Button>See All</Button>}>
  <ListCard />
  <ListCard />
</Section>
```

---

### TagPill Component
**Location**: `src/components/TagPill.tsx`

**Usage**:
```tsx
<TagPill label="coffee" onClick={handleClick} />
<TagPill label="trending" selected count={12} />
<TagPill label="tag" removable onRemove={handleRemove} />
```

---

## 🎯 Best Practices

### 1. Component Hierarchy
**Preferred order**:
1. Use existing components (`Button`, `Card`, `Modal`, `Input`)
2. Use utility classes (`.card-standard`, `.type-title`)
3. Use Tailwind utilities as last resort

### 2. Spacing
Use Tailwind's spacing scale consistently:
- **Cards**: `p-6` (1.5rem)
- **Modals**: `p-6` (1.5rem)
- **Buttons**: Internal spacing handled by component
- **Sections**: `space-y-3` or `space-y-4`
- **Lists**: `space-y-4` or `gap-4`

### 3. Transitions
Always add transitions for interactive elements:
```tsx
className="transition-all duration-200"
className="transition-colors duration-200"
```

### 4. Focus States
Always include focus-visible states for accessibility:
```tsx
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-300"
```

### 5. Mobile First
- Design for mobile (max-width: 448px)
- Use safe area insets: `pt-safe`, `pb-safe`
- Min tap targets: 44px (`min-h-[44px]`)

---

## 🚫 Anti-Patterns (Avoid)

❌ **Don't** use random text sizes
```tsx
<div className="text-sm">Title</div> // ❌
<div className="type-title">Title</div> // ✅
```

❌ **Don't** use inline button styles
```tsx
<button className="px-4 py-2 bg-sage-600...">Save</button> // ❌
<Button variant="primary">Save</Button> // ✅
```

❌ **Don't** mix border radius values
```tsx
<div className="rounded-2xl"> // ❌ for cards
<div className="rounded-xl">  // ✅ for cards
```

❌ **Don't** use default Tailwind shadows
```tsx
<div className="shadow-lg">  // ❌
<div className="shadow-botanical"> // ✅
```

❌ **Don't** create one-off modal patterns
```tsx
// ❌ Custom modal markup
<div className="fixed inset-0...">
  <div className="bg-white p-4...">

// ✅ Use Modal component
<Modal isOpen={true} title="...">
```

---

## 📦 Utility Class Reference

### Card Utilities
- `.card-standard` - Standard card
- `.card-interactive` - Interactive card
- `.cozy-card` - Cozy rounded card

### Button Utilities
- `.btn`, `.btn-sm`, `.btn-md`, `.btn-lg`
- `.btn-primary`, `.btn-secondary`
- `.btn-icon`

### Badge Utilities
- `.badge`, `.badge-primary`, `.badge-secondary`
- `.badge-success`, `.badge-warning`, `.badge-danger`

### Input Utilities
- `.input-standard` - Standard input field
- `.input-error` - Error state input

### Layout Utilities
- `.pt-safe`, `.pb-safe` - Safe area padding
- `.no-scrollbar` - Hide scrollbars

---

## 🔄 Migration Guide

If you have existing components that don't follow these patterns:

1. **Replace custom buttons** → Use `Button` component
2. **Replace custom modals** → Use `Modal` component
3. **Replace inline card styles** → Use `Card` component
4. **Replace text sizes** → Use type scale utilities
5. **Replace custom shadows** → Use botanical shadow system
6. **Replace rounded-2xl on cards** → Use `rounded-xl`

---

## 📚 Resources

- **Tailwind Config**: `/tailwind.config.cjs`
- **Global Styles**: `/src/index.css`
- **Components**: `/src/components/`
- **Design Tokens**: See CSS variables in index.css

---

**Last Updated**: 2025-01-05
**Maintainer**: Development Team
