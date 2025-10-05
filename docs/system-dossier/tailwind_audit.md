# Tailwind Audit

## Hardcoded Colors Found

### Hex Colors
**src/components/Button.tsx:16-19**
```typescript
primary: 'text-white bg-sage-600 hover:bg-sage-700 disabled:opacity-50',
secondary: 'bg-white border border-linen-200 text-charcoal-800 hover:bg-linen-50 disabled:opacity-50',
ghost: 'bg-transparent text-charcoal-700 hover:bg-linen-50',
dark: 'text-black bg-white/90 hover:bg-white disabled:opacity-50'
```
*Issue: Using hardcoded color classes instead of design tokens*

**src/components/PostModal.tsx:162-175**
```typescript
<div className="flex items-center gap-1 bg-[#FF6B6B]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
<div className="flex items-center gap-1 bg-[#4CAF50]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
```
*Issue: Hardcoded hex colors #FF6B6B and #4CAF50 instead of using warm-500 and sage-500*

**src/components/PostModal.tsx:181-195**
```typescript
className="fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300"
className="absolute inset-0 bg-black/40 backdrop-blur-sm"
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl"
```
*Issue: Hardcoded hex colors #FDFBF7 and #F3EBE2 instead of using surface and linen tokens*

**src/components/PostModal.tsx:189-194**
```typescript
className="p-4 flex items-center justify-between border-b border-[#E8D4C0]/50"
className="text-xl font-bold text-[#5D4A2E] font-serif truncate"
className="p-2 rounded-full hover:bg-[#E8D4C0]/30 transition-colors"
```
*Issue: Hardcoded hex colors #E8D4C0 and #5D4A2E instead of using linen and cozy-title tokens*

## Arbitrary Values Found

### Arbitrary Shadows
**src/components/PostModal.tsx:185**
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
*Issue: Using shadow-2xl instead of defined shadow tokens*

### Arbitrary Spacing
**src/components/PostModal.tsx:185**
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
*Issue: Using max-h-[90vh] instead of defined spacing tokens*

### Arbitrary Z-Index
**src/components/PostModal.tsx:181**
```typescript
className="fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300"
```
*Issue: Using z-[10000] instead of defined z-index tokens*

## Inconsistent Border Radius

### Mixed Radius Usage
**src/components/Button.tsx:9**
```typescript
const base = 'inline-flex items-center justify-center rounded-full font-medium focus:outline-none'
```
*Issue: Using rounded-full consistently*

**src/components/Card.tsx:16**
```typescript
className={`bg-white rounded-xl border border-linen-200 ${interactive ? 'hover:bg-linen-50 transition' : ''} ` + className}
```
*Issue: Using rounded-xl consistently*

**src/components/PostModal.tsx:185**
```typescript
className="relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20"
```
*Issue: Using rounded-2xl instead of defined radius tokens*

## Summary of Violations

### Most Common Issues:
1. **Hardcoded hex colors** - Found in PostModal.tsx with #FF6B6B, #4CAF50, #FDFBF7, #F3EBE2, #E8D4C0, #5D4A2E
2. **Arbitrary z-index values** - Using z-[10000] instead of defined z-index scale
3. **Arbitrary spacing** - Using max-h-[90vh] instead of defined spacing tokens
4. **Inconsistent shadows** - Using shadow-2xl instead of defined shadow tokens

### Recommendations:
1. Replace hardcoded hex colors with design tokens from tailwind.config.cjs
2. Define z-index scale in tailwind.config.cjs
3. Define spacing scale for viewport units
4. Use consistent shadow tokens throughout the application
5. Audit all components for similar violations

### Files Requiring Attention:
- `src/components/PostModal.tsx` - Multiple hardcoded colors and arbitrary values
- `src/components/Button.tsx` - Generally good, but could use more design tokens
- `src/components/Card.tsx` - Generally good, consistent with design tokens
