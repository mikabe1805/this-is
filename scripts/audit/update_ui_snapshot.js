/**
 * Update UI snapshot document with current status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_PATH = path.join(__dirname, '../../docs/ui-status/SNAPSHOT.md');
const A11Y_PATH = path.join(__dirname, '../../docs/ui-status/a11y_report.md');
const SCREENSHOT_DIR = path.join(__dirname, '../../docs/ui-status/screenshots');

function updateSnapshot() {
  console.log('📝 Updating UI snapshot...');

  // Read existing snapshot
  let snapshot = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  let a11y = fs.readFileSync(A11Y_PATH, 'utf8');

  // Update timestamps
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  snapshot = snapshot.replace(/\*Last updated: \[AUTO-GENERATED\]\*/g, `*Last updated: ${timestamp}*`);
  a11y = a11y.replace(/\*Last updated: \[AUTO-GENERATED\]\*/g, `*Last updated: ${timestamp}*`);

  // Check for screenshots
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  const screenshotStatus = screenshots.length > 0
    ? `✅ ${screenshots.length} screenshots captured`
    : '⚠️  No screenshots yet (see INSTRUCTIONS.md)';

  // Update screenshot section
  const screenshotSection = `
## 📊 Screenshots

**Status**: ${screenshotStatus}

See \`/docs/ui-status/screenshots/\` for visual reference:

${screenshots.length > 0 ? screenshots.map(f => `- \`${f}\` - ${getPageDescription(f.replace('.png', ''))}`).join('\n') : '- Run `npm run status:ui` to capture screenshots'}

---
`;

  // Replace screenshot section
  snapshot = snapshot.replace(
    /## 📊 Screenshots[\s\S]*?---/,
    screenshotSection.trim() + '\n\n---'
  );

  // Write updated files
  fs.writeFileSync(SNAPSHOT_PATH, snapshot, 'utf8');
  fs.writeFileSync(A11Y_PATH, a11y, 'utf8');

  console.log('✅ UI snapshot updated!');
  console.log(`   - SNAPSHOT.md: ${timestamp}`);
  console.log(`   - a11y_report.md: ${timestamp}`);
  console.log(`   - Screenshots: ${screenshotStatus}`);
}

function getPageDescription(pageName) {
  const descriptions = {
    home: 'Home feed (Popular Nearby, Trending Tags, Lists You Might Like)',
    explore: 'Explore page (Nearby tab, glass cards)',
    hub: 'Hub detail page (PageHeader, ActionBar, solid sections)',
    list: 'List view page (PageHeader, search, place cards)'
  };
  return descriptions[pageName] || pageName;
}

// Run if called directly
updateSnapshot();

export { updateSnapshot };

