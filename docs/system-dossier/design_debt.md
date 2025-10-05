# Design Debt

## Visual Inconsistencies

### Inconsistent Border Radius
**File**: `src/components/Button.tsx:9`
```typescript
const base = 'inline-flex items-center justify-center rounded-full font-medium focus:outline-none'
```
**Issue**: Using `rounded-full` instead of design tokens
**Suggested Fix**: Use `rounded-xl` from design system

**File**: `src/components/Card.tsx:16`
```typescript
className={`bg-white rounded-xl border border-linen-200 ${interactive ? 'hover:bg-linen-50 transition' : ''} ` + className}
```
**Issue**: Using `rounded-xl` consistently
**Status**: Good

**File**: `src/components/PostModal.tsx:185`
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
**Issue**: Using `rounded-2xl` instead of design tokens
**Suggested Fix**: Use `rounded-xl` from design system

### Inconsistent Shadows
**File**: `src/components/PostModal.tsx:185`
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
**Issue**: Using `shadow-2xl` instead of design tokens
**Suggested Fix**: Use `shadow-crystal` from design system

**File**: `src/components/Card.tsx:16`
```typescript
className={`bg-white rounded-xl border border-linen-200 ${interactive ? 'hover:bg-linen-50 transition' : ''} ` + className}
```
**Issue**: No shadow applied
**Suggested Fix**: Add `shadow-soft` from design system

### Inconsistent Spacing
**File**: `src/components/Button.tsx:10-14`
```typescript
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
}
```
**Issue**: Using arbitrary spacing values
**Suggested Fix**: Use design system spacing tokens

**File**: `src/components/PostModal.tsx:185`
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
**Issue**: Using `max-h-[90vh]` instead of design tokens
**Suggested Fix**: Use design system spacing tokens

## Text on Images Issues

### Missing Scrims
**File**: `src/pages/Home.tsx:966-972`
```typescript
<img
  src={activity.placeImage}
  alt={activity.place?.name}
  className="w-full h-32 object-cover rounded-lg mt-3"
  onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png' }}
/>
```
**Issue**: Text overlay on images without contrast scrim
**Suggested Fix**: Add gradient overlay for text readability

**File**: `src/pages/Search.tsx:1246-1248`
```typescript
<img src={((images as any)[0] || (item as any).mainImage || '/assets/leaf.png')} alt={item.name} className="absolute inset-0 w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/leaf.png' }} />
```
**Issue**: Text may be overlaid on images without sufficient contrast
**Suggested Fix**: Add gradient overlay for text readability

## Inconsistent Component Usage

### Button Variants
**File**: `src/components/Button.tsx:15-20`
```typescript
const variants = {
  primary: 'text-white bg-sage-600 hover:bg-sage-700 disabled:opacity-50',
  secondary: 'bg-white border border-linen-200 text-charcoal-800 hover:bg-linen-50 disabled:opacity-50',
  ghost: 'bg-transparent text-charcoal-700 hover:bg-linen-50',
  dark: 'text-black bg-white/90 hover:bg-white disabled:opacity-50'
}
```
**Issue**: Using hardcoded colors instead of design tokens
**Suggested Fix**: Use design system color tokens

### Card Components
**File**: `src/components/Card.tsx:16`
```typescript
className={`bg-white rounded-xl border border-linen-200 ${interactive ? 'hover:bg-linen-50 transition' : ''} ` + className}
```
**Issue**: Good - using design tokens consistently
**Status**: Good

### Modal Components
**File**: `src/components/PostModal.tsx:181-195`
```typescript
className="fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300"
className="absolute inset-0 bg-black/40 backdrop-blur-sm"
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl"
```
**Issue**: Using hardcoded colors and arbitrary z-index
**Suggested Fix**: Use design system tokens

## Color Inconsistencies

### Hardcoded Hex Colors
**File**: `src/components/PostModal.tsx:162-175`
```typescript
<div className="flex items-center gap-1 bg-[#FF6B6B]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
<div className="flex items-center gap-1 bg-[#4CAF50]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
```
**Issue**: Using hardcoded hex colors instead of design tokens
**Suggested Fix**: Use `bg-warm-500` and `bg-sage-500` from design system

**File**: `src/components/PostModal.tsx:189-194`
```typescript
className="p-4 flex items-center justify-between border-b border-[#E8D4C0]/50"
className="text-xl font-bold text-[#5D4A2E] font-serif truncate"
className="p-2 rounded-full hover:bg-[#E8D4C0]/30 transition-colors"
```
**Issue**: Using hardcoded hex colors instead of design tokens
**Suggested Fix**: Use `border-linen-200`, `text-cozy-title`, and `hover:bg-linen-50` from design system

## Typography Inconsistencies

### Font Size Inconsistencies
**File**: `src/components/Button.tsx:10-14`
```typescript
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
}
```
**Issue**: Using arbitrary font sizes
**Suggested Fix**: Use design system typography tokens

**File**: `src/components/PostModal.tsx:189-194`
```typescript
className="text-xl font-bold text-[#5D4A2E] font-serif truncate"
```
**Issue**: Using hardcoded font sizes
**Suggested Fix**: Use design system typography tokens

### Font Weight Inconsistencies
**File**: `src/components/Button.tsx:9`
```typescript
const base = 'inline-flex items-center justify-center rounded-full font-medium focus:outline-none'
```
**Issue**: Using `font-medium` consistently
**Status**: Good

**File**: `src/components/PostModal.tsx:189-194`
```typescript
className="text-xl font-bold text-[#5D4A2E] font-serif truncate"
```
**Issue**: Using `font-bold` instead of design tokens
**Suggested Fix**: Use design system font weight tokens

## GAP Analysis

### Missing Design System Features:
1. **No spacing scale** - Should define spacing tokens
2. **No typography scale** - Should define typography tokens
3. **No animation tokens** - Should define animation tokens
4. **No component variants** - Should define component variants

### Suggested Improvements:
1. **Implement design tokens** for all visual properties
2. **Create component variants** for consistent usage
3. **Add animation tokens** for consistent animations
4. **Implement design system documentation** for developers

## Migration Recommendations

### High Priority:
1. **Replace hardcoded colors** with design tokens
2. **Standardize border radius** across components
3. **Implement consistent shadows** using design tokens
4. **Add text scrims** for images with text overlays

### Medium Priority:
1. **Standardize spacing** using design tokens
2. **Implement consistent typography** using design tokens
3. **Add component variants** for consistent usage
4. **Implement animation tokens** for consistent animations

### Low Priority:
1. **Create design system documentation** for developers
2. **Implement component testing** for design consistency
3. **Add design system validation** in CI/CD
4. **Create design system examples** for developers
