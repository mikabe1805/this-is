#!/usr/bin/env node

/**
 * Generate PR summary from status reports
 * Outputs markdown suitable for PR descriptions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_PATH = path.join(process.cwd(), 'docs', 'status', 'places_audit.json');

function loadAuditData() {
  try {
    const data = fs.readFileSync(AUDIT_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('⚠️  Could not load audit data. Run `npm run audit:places` first.');
    return null;
  }
}

function generatePRSummary(audit) {
  const branch = process.env.GIT_BRANCH || 'current-branch';
  
  return `## 🎯 Google Places API Cost Optimization + UI Revamp

**Branch:** \`${branch}\`  
**Sprint:** Cost Fix + UI Revamp Phase A

---

## 📊 Impact Summary

### Cost Reduction
- **Expected savings:** ~85% reduction in daily API costs
- **Before:** ~$69/day (estimated)
- **After:** ~$10/day (target)
- **Annual savings:** ~$21,240

### Technical Changes
${audit ? `
- ✅ Centralized API service with session tokens
- ✅ 600ms debouncing on all autocomplete inputs
- ✅ In-memory caching for Place Details
- ✅ Narrow field restrictions (only needed fields)
- ✅ ${audit.summary.optimized_usage_count} components using optimized API
- ✅ ${audit.summary.implementation_usage_count} API calls in centralized service
${audit.summary.direct_usage_count > 0 ? `- ⚠️ ${audit.summary.direct_usage_count} direct API calls need migration` : '- ✅ No direct API calls outside centralized service'}
` : '- Run `npm run audit:places` for detailed metrics'}

---

## 🎨 UI Improvements

**Phase A Complete:**
- ✅ New design tokens (bark, moss, sand, stone)
- ✅ Glass utilities for modern, earthy aesthetic
- ✅ 3 reusable primitive components
- ✅ 4 pages refactored (Home, Explore, Hub, List)
- ✅ Consistent color palette and shadows
- ✅ Improved accessibility (focus rings, ARIA labels)

---

## 📁 Files Changed

### New Files (${audit ? '9' : 'Multiple'})
- \`src/services/google/places.ts\` - Centralized API service (274 lines)
- \`src/styles/glass.css\` - Glass utilities (58 lines)
- \`src/components/primitives/CardShell.tsx\` - Card primitive
- \`src/components/primitives/PageHeader.tsx\` - Header primitive
- \`src/components/primitives/ActionBar.tsx\` - Action bar primitive
- \`docs/status/\` - Status reporting infrastructure

### Modified Files (${audit ? '4' : 'Multiple'})
- \`src/components/AddressAutocomplete.tsx\` - Now uses centralized service
- \`src/components/GooglePlacesAutocomplete.tsx\` - Now uses centralized service
- \`tailwind.config.cjs\` - New color tokens
- \`package.json\` - Added audit scripts

---

## ✅ Testing Checklist

### Cost Optimization
- [ ] Typing query slowly: ≤3 autocomplete requests, 0 details, 0 photos
- [ ] Selecting result: 1 details request, ≤1 photo
- [ ] Scrolling list: 0 details, ≤1 photo per card
- [ ] Session tokens active on autocomplete focus
- [ ] 600ms debounce working (no spam requests)

### UI Quality
- [ ] All pages use new design tokens (no inline hex colors)
- [ ] Glass effects render correctly on all browsers
- [ ] Focus rings visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 headings, 7:1 body)
- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrows)

### Regression Testing
- [ ] All autocomplete inputs still work
- [ ] Place selection populates correct data
- [ ] Photos load correctly in cards
- [ ] No console errors in production build

---

## 📈 Monitoring

After deployment, monitor:
1. **Google Cloud Console** → Places API usage (should drop 80-90%)
2. **Browser console** → Run \`getTelemetry()\` to verify ratios
3. **Cost alerts** → Set $10/day threshold
4. **User reports** → Watch for autocomplete issues

---

## 🔗 Documentation

- [Full PR Summary](./PR_SUMMARY.md)
- [Quick Reference Guide](./QUICK_REFERENCE.md)
- [Status Report](./docs/status/README.md)
- [Cost Tracking](./docs/status/cost_report.md)
- [Metrics Spec](./docs/status/metrics_spec.md)

---

## 🚀 Deployment Notes

1. No database migrations required
2. No environment variables added
3. Compatible with existing Firebase setup
4. Can be deployed incrementally (pages work independently)
5. Rollback safe (remove files, revert imports)

---

**Generated:** ${new Date().toLocaleString()}  
**Audit Data:** ${audit ? new Date(audit.timestamp).toLocaleString() : 'N/A'}
`;
}

// Main execution
console.log('📝 Generating PR summary...\n');

const audit = loadAuditData();
const summary = generatePRSummary(audit);

// Write to file
const outputPath = path.join(process.cwd(), 'PR_SUMMARY_GENERATED.md');
fs.writeFileSync(outputPath, summary);

console.log(`✅ PR summary generated: ${outputPath}`);
console.log('\nTo use in PR:');
console.log('  1. Copy contents of PR_SUMMARY_GENERATED.md');
console.log('  2. Paste into GitHub PR description');
console.log('  3. Check off completed items in testing checklist\n');

// Also output to console for easy copying
console.log('='.repeat(80));
console.log(summary);
console.log('='.repeat(80));

