# UI Style Guide - Earthy Glassmorphic Design

## Design Philosophy
**"Earthy, glassmorphic, soft blurry glass vibes with accents of subtle sunlight streaks"**

Our UI combines warm, natural tones with translucent glass effects and soft sunlight that creates depth and warmth.

## Color Palette

### Primary Colors (Use liberally)
- **Bark (Text & Structure)**
  - `--bark-900`: #3D3630 - Primary headings, strong text
  - `--bark-700`: #5C534A - Body text, secondary text
  - Use: `text-title`, `text-body`, `text-meta`

- **Moss (Interactive Elements & Accents)**
  - `--moss-700`: #5E765C - Primary buttons
  - `--moss-600`: #6F8A6B - Interactive elements, links
  - `--moss-500`: #8FA287 - Soft highlights
  - Use: `btn-primary`, `accent-moss`, `badge-moss`, `text-moss-600`

- **Aurum (Warm Accents)**
  - `--aurum-300`: #E8DBB5 - Warm highlights, special tags
  - `--aurum-200`: #F0E6CE - Subtle warmth
  - Use: `accent-aurum`, `badge-aurum`, `text-aurum-300`

### Background Colors
- **Parchment (Backgrounds)**
  - `--parchment-50`: #F7F5F2 - Main page background
  - `--parchment-100`: #EEECE7 - Secondary surfaces
  - `--parchment-200`: #E8E3DA - Tertiary surfaces

## Text Hierarchy

### Standard Text (For light/glass backgrounds)
```css
.text-title     /* Headings: bark-900, 16px, weight 600 */
.text-body      /* Body text: bark-800, 14px */
.text-meta      /* Meta/secondary: rgba(74,66,60,0.90), 13px */
.text-muted     /* Subtle text: rgba(74,66,60,0.78) */
```

### Section Text
```css
.section-title  /* Section headings */
.section-meta   /* Section subtitles */
```

### Image Overlays
```css
.text-on-image  /* Light text with shadow for photos */
```

## Glass Components

### Basic Glass Card
```tsx
<div className="glass-card">
  {/* Content */}
</div>
```

### Glass Card with Sunlight
```tsx
<div className="glass-card sun-edge">
  {/* Content with subtle sunlight accent */}
</div>
```

### Pills & Badges

#### Standard Badge
```tsx
<span className="badge text-meta">
  Category
</span>
```

#### Moss Badge (for nature/outdoor tags)
```tsx
<span className="badge-moss">
  Park
</span>
```

#### Aurum Badge (for special/premium tags)
```tsx
<span className="badge-aurum">
  Featured
</span>
```

## Buttons

### Primary Button (Call to Action)
```tsx
<button className="btn-primary px-6 py-3">
  Create Hub
</button>
```

### Secondary Button (Alternative Action)
```tsx
<button className="btn-secondary px-5 py-2.5">
  Cancel
</button>
```

### Ghost Button (from cozy-glass.css)
```tsx
<button className="pill--quiet">
  Learn More
</button>
```

## Sunlight Layer

The app has a global `.sunlight-layer` element that provides ambient warm lighting. This is automatically added in `App.tsx` and should not be duplicated.

### Radial Warm Accent (for specific sections)
```tsx
<div className="radial-warm">
  {/* Content with warm ambient glow */}
</div>
```

## Accent Utilities

### Colors
```css
.accent-moss      /* Moss green text color */
.accent-aurum     /* Warm aurum text color */
```

### Backgrounds
```css
.bg-moss-soft     /* Subtle moss background */
.bg-aurum-soft    /* Subtle aurum background */
```

### Borders
```css
.border-moss      /* Moss border */
.border-aurum     /* Aurum border */
```

## Best Practices

### ✅ DO:
- Use `text-title`, `text-body`, `text-meta` for consistent text hierarchy
- Add `.sun-edge` to 1-2 hero cards per page for focal points
- Use moss greens for interactive elements and nature-related content
- Use aurum accents sparingly for special/featured items
- Leverage the global sunlight layer for ambient warmth
- Use badges to categorize and add visual variety

### ❌ DON'T:
- Don't use light text colors (parchment-50/100) on light backgrounds
- Don't add `.sun-edge` to every card (it dilutes the effect)
- Don't use opacity below 0.75 for important text (causes ghost text)
- Don't mix multiple accent colors on a single element
- Don't duplicate the sunlight layer

## Common Patterns

### Card with Category Badge
```tsx
<div className="glass-card sun-edge p-4">
  <div className="mb-2">
    <span className="badge-moss text-xs">
      Coffee Shop
    </span>
  </div>
  <h3 className="text-title mb-1">
    Blue Bottle Coffee
  </h3>
  <p className="text-meta">
    0.5 mi away
  </p>
</div>
```

### Section Header with Accent
```tsx
<div className="mb-4">
  <h2 className="section-title text-moss-600">
    Suggested for You
  </h2>
  <p className="section-meta">
    Based on your interests
  </p>
</div>
```

### Interactive List Item
```tsx
<button className="glass-card hover:shadow-lg transition p-3 w-full text-left">
  <div className="flex items-center gap-3">
    {/* Icon */}
    <div className="text-title">Item Name</div>
  </div>
  <div className="text-meta mt-1">
    Description text
  </div>
</button>
```

## Migration Guide

### Fixing Ghost Text
Replace low-opacity text:
```diff
- <p className="text-stone-400">Text</p>
+ <p className="text-meta">Text</p>

- <span style={{opacity: 0.6}}>Faded</span>
+ <span className="text-muted">Readable</span>
```

### Adding Color Variety
```diff
- <span className="badge">Generic</span>
+ <span className="badge-moss">Nature</span>
+ <span className="badge-aurum">Featured</span>

- <button className="bg-gray-500">Action</button>
+ <button className="btn-primary">Action</button>
```

### Enhancing Glass Cards
```diff
- <div className="glass-card">
+ <div className="glass-card sun-edge">
```

## Animation & Interaction

### Hover Lift
```tsx
<div className="glass-card hover-lift hover-lift-on">
  {/* Lifts slightly on hover */}
</div>
```

### Fade In
```tsx
<div className="animate-fade-slow">
  {/* Fades in on mount */}
</div>
```

### Shimmer Effect
```tsx
<button className="shimmer shimmer-run">
  {/* Shimmer on hover */}
</button>
```
