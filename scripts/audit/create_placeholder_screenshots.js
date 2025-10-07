#!/usr/bin/env node

/**
 * Create placeholder screenshots with instructions
 * Used when Playwright isn't available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(process.cwd(), 'docs', 'status', 'screenshots');

const PAGES = [
  { name: 'Home', file: 'home-mobile.png', path: '/', description: 'Popular Nearby, Trending Tags, Lists' },
  { name: 'Explore', file: 'explore-mobile.png', path: '/explore', description: 'Nearby | Following | Discover tabs' },
  { name: 'Place Hub', file: 'hub-mobile.png', path: '/place/:id', description: 'Cover image, tabs, action bar' },
  { name: 'List View', file: 'list-mobile.png', path: '/list/:id', description: 'List header, places, map tab' },
];

function createInstructionsFile() {
  const content = `# Screenshot Instructions

## Manual Capture (Recommended)

Since Playwright isn't installed, please capture screenshots manually:

### Setup
1. Open your app in Chrome DevTools Device Mode
2. Set viewport to **375x667** (iPhone SE)
3. Ensure you're logged in
4. Clear cache and reload

### Pages to Capture

${PAGES.map((page, i) => `
${i + 1}. **${page.name}** (\`${page.path}\`)
   - Navigate to: ${page.path}
   - Wait for all content to load
   - Screenshot → Save as: \`docs/status/screenshots/${page.file}\`
   - Shows: ${page.description}
`).join('\n')}

### Tips
- Use full-page screenshots (not just viewport)
- Ensure images are fully loaded before capturing
- Use consistent viewport size for all screenshots
- Save as PNG (not JPG)

## Automated Capture (Optional)

If you want automated screenshots:

\`\`\`bash
# Install Playwright
npm install -D playwright
npx playwright install chromium

# Start dev server
npm run dev

# In another terminal
npm run status:screens
\`\`\`

---

**After capturing screenshots**, run:
\`\`\`bash
npm run status:update
\`\`\`

This will update the status README with your screenshot links.
`;

  const instructionsPath = path.join(SCREENSHOTS_DIR, 'INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, content);
  
  return instructionsPath;
}

function createPlaceholderREADME() {
  const content = `# Screenshots

This directory contains mobile viewport screenshots of the main pages.

## Status

${PAGES.map(page => `- [ ] ${page.file} - ${page.name}`).join('\n')}

## Capture Instructions

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for detailed capture steps.

Quick steps:
1. Open app in Chrome DevTools Device Mode
2. Set viewport to 375x667 (iPhone SE)
3. Navigate to each page and screenshot
4. Save screenshots here with exact filenames above

---

**Viewport:** 375x667 (iPhone SE)  
**Format:** PNG  
**Type:** Full-page screenshots
`;

  const readmePath = path.join(SCREENSHOTS_DIR, 'README.md');
  fs.writeFileSync(readmePath, content);
  
  return readmePath;
}

// Main execution
console.log('📸 Creating screenshot placeholders...\n');

// Ensure directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Create instruction files
const instructionsPath = createInstructionsFile();
const readmePath = createPlaceholderREADME();

console.log(`✅ Created: ${instructionsPath}`);
console.log(`✅ Created: ${readmePath}`);

console.log('\n📝 Next steps:');
console.log('  1. Follow instructions in docs/status/screenshots/INSTRUCTIONS.md');
console.log('  2. Capture 4 screenshots manually (or install Playwright)');
console.log('  3. Run: npm run status:update\n');

console.log('💡 For automated screenshots:');
console.log('   npm install -D playwright');
console.log('   npx playwright install chromium');
console.log('   npm run status:screens\n');

