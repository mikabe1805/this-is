#!/usr/bin/env node

/**
 * Update docs/status/README.md with current audit data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_PATH = path.join(process.cwd(), 'docs', 'status', 'places_audit.json');
const README_PATH = path.join(process.cwd(), 'docs', 'status', 'README.md');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'docs', 'status', 'screenshots');

function loadAuditData() {
  try {
    const data = fs.readFileSync(AUDIT_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('⚠️  Could not load audit data. Run `npm run audit:places` first.');
    return null;
  }
}

function getScreenshots() {
  try {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      return [];
    }
    return fs.readdirSync(SCREENSHOTS_DIR)
      .filter(f => f.endsWith('.png'))
      .sort();
  } catch (error) {
    return [];
  }
}

function generateReadme(audit) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'full',
    timeStyle: 'short'
  });
  
  const screenshots = getScreenshots();
  
  return `# Status Report

**Last Updated:** ${timestamp}  
**Branch:** \`revamp/ui-cozy-glass\` → \`status/report-setup\`

---

## 📊 Quick Summary

${audit ? `
| Metric | Value |
|--------|-------|
| **Total API Findings** | ${audit.summary.total_findings} |
| **Direct Usage (needs migration)** | ${audit.summary.direct_usage_count} ⚠️ |
| **Optimized Usage** | ${audit.summary.optimized_usage_count} ✅ |
| **Audit Date** | ${new Date(audit.timestamp).toLocaleString()} |

### Breakdown by Kind

${Object.entries(audit.summary.by_kind).map(([kind, count]) => `- **${kind}:** ${count}`).join('\n')}
` : `
⚠️ **No audit data available.** Run \`npm run audit:places\` to generate report.
`}

---

## 💰 Cost Summary

> **Note:** Fill in actual costs in \`cost_report.md\`

Current estimated daily cost based on optimizations:

- **Before:** ~$69/day (estimated)
- **Target:** ~$10/day
- **Expected Reduction:** ~85%

**Key Optimizations:**
- ✅ Session token management (one token per autocomplete session)
- ✅ 600ms debouncing on user input
- ✅ 3-character minimum before API calls
- ✅ Narrow field restrictions (only requesting needed fields)
- ✅ In-memory caching for Place Details
- ✅ Centralized API service (\`src/services/google/places.ts\`)

📝 [View detailed cost report →](./cost_report.md)

---

## 🎨 UI Revamp Progress

**Phase A: Foundation** (Current)

- ✅ Design tokens (bark, moss, sand, stone)
- ✅ Glass utilities (\`.panel\`, \`.glass\`, \`.scrim\`)
- ✅ Primitive components (CardShell, PageHeader, ActionBar)
- ✅ Page refactors (Home, Explore, Hub, List)

📝 [View UI progress details →](./ui_revamp_progress.md)

### Screenshots

${screenshots.length > 0 ? screenshots.map(s => `- ![${s.replace('.png', '')}](./screenshots/${s})`).join('\n') : '⚠️ No screenshots available. Run `npm run status:screens` to capture pages.'}

---

## 🔍 Google Places API Audit

${audit ? `
### Status

${audit.summary.direct_usage_count > 0 ? `
⚠️ **Action Required:** ${audit.summary.direct_usage_count} direct API call(s) found that should be migrated to the centralized service.

**Direct usages to fix:**
${audit.direct_usages.slice(0, 5).map(d => `- \`${d.file}:${d.line}\` - ${d.symbol}`).join('\n')}
${audit.direct_usages.length > 5 ? `\n_...and ${audit.direct_usages.length - 5} more. See places_audit.json for full list._` : ''}
` : `
✅ **All clear!** No direct API calls found. All usage goes through centralized service.
`}

**Optimized usages:** ${audit.summary.optimized_usage_count} calls using \`src/services/google/places.ts\`

` : ''}

📄 [View full audit report →](./places_audit.json)

---

## 📈 Metrics & Analytics

Track these key metrics to monitor optimization effectiveness:

**Places API Events:**
- \`places_autocomplete_request\`
- \`places_details_request\`
- \`places_photo_request\`
- \`places_session_start\` / \`places_session_end\`

**UI Performance Events:**
- \`page_load_complete\`
- \`component_render_time\`
- \`autocomplete_interaction\`

📝 [View metrics specification →](./metrics_spec.md)

---

## 🚀 Next Actions

### Immediate
${audit && audit.summary.direct_usage_count > 0 ? `
1. **Migrate direct API calls** - Update ${audit.summary.direct_usage_count} file(s) to use centralized service
` : ''}
2. **Capture screenshots** - Run \`npm run status:screens\` (requires dev server + Playwright)
3. **Fill cost data** - Add real numbers to \`cost_report.md\` from Google Cloud Console
4. **Set up monitoring** - Implement telemetry events from \`metrics_spec.md\`

### This Week
- Monitor Google Cloud Console for actual cost reduction
- Set up budget alerts ($10/day threshold)
- Capture baseline metrics before deployment
- Test autocomplete behavior on staging

### Phase B (Next Sprint)
- Implement deck view for Explore page
- Add page transition animations
- Lazy-load images with IntersectionObserver
- Add skeleton loading states
- Replace interactive maps with Static Maps where possible

---

## 📝 Files in This Report

- \`README.md\` - This file (auto-generated)
- \`cost_report.md\` - Cost tracking template
- \`ui_revamp_progress.md\` - UI checklist with screenshots
- \`metrics_spec.md\` - Analytics events specification
- \`places_audit.json\` - Auto-generated API usage audit
- \`screenshots/\` - Page screenshots (mobile viewport)

---

## 🛠 Commands

\`\`\`bash
# Run Places API audit
npm run audit:places

# Capture page screenshots (requires dev server running)
npm run status:screens

# Update this README with latest data
npm run status:update
\`\`\`

---

**Generated by:** \`scripts/audit/update_readme.js\`  
**Audit data from:** ${audit ? new Date(audit.timestamp).toLocaleString() : 'N/A'}
`;
}

// Main execution
console.log('📝 Updating status README...');

const audit = loadAuditData();
const readme = generateReadme(audit);

fs.writeFileSync(README_PATH, readme);

console.log(`✅ README updated: ${README_PATH}`);

if (audit) {
  console.log('\n📊 Current status:');
  console.log(`   Total findings: ${audit.summary.total_findings}`);
  console.log(`   Direct usage: ${audit.summary.direct_usage_count}`);
  console.log(`   Optimized usage: ${audit.summary.optimized_usage_count}`);
  
  if (audit.summary.direct_usage_count > 0) {
    console.log('\n⚠️  Action required: Migrate direct API calls to centralized service');
  }
}

