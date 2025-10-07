/**
 * Screenshot UI pages for status reporting
 * Uses Playwright if installed, otherwise creates placeholders
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../../docs/ui-status/screenshots');
const PAGES = [
  { name: 'home', url: '/', viewport: { width: 375, height: 812 } },
  { name: 'explore', url: '/explore', viewport: { width: 375, height: 812 } },
  { name: 'hub', url: '/hub/test-id', viewport: { width: 375, height: 812 } },
  { name: 'list', url: '/list/test-id', viewport: { width: 375, height: 812 } }
];

async function captureScreenshots() {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Check if Playwright is installed
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    console.log('⚠️  Playwright not installed. Creating placeholder screenshots...');
    createPlaceholders();
    return;
  }

  console.log('📸 Starting screenshot capture...');

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2
  });

  for (const page of PAGES) {
    try {
      const browserPage = await context.newPage();
      
      // Navigate to local dev server
      // Assumes dev server is running on localhost:5173 (Vite default)
      const url = `http://localhost:5173${page.url}`;
      console.log(`  → Capturing ${page.name} from ${url}`);
      
      await browserPage.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for content to load
      await browserPage.waitForTimeout(1000);
      
      // Take screenshot
      const outputPath = path.join(SCREENSHOT_DIR, `${page.name}.png`);
      await browserPage.screenshot({ path: outputPath, fullPage: false });
      
      console.log(`  ✓ Saved ${page.name}.png`);
      await browserPage.close();
    } catch (error) {
      console.error(`  ✗ Failed to capture ${page.name}:`, error.message);
      // Create placeholder on error
      createPlaceholder(page.name);
    }
  }

  await browser.close();
  console.log('✅ Screenshot capture complete!');
}

function createPlaceholders() {
  for (const page of PAGES) {
    createPlaceholder(page.name);
  }
  
  // Write instructions
  const instructions = `# Screenshot Instructions

## Manual Capture

Since Playwright is not installed, please capture screenshots manually:

1. **Start the dev server**: \`npm run dev\`
2. **Open browser** to \`http://localhost:5173\`
3. **Set mobile viewport**: 375x812 (iPhone X)
4. **Capture each page**:
   - Home: \`/\`
   - Explore: \`/explore\`
   - Hub: \`/hub/<any-id>\`
   - List: \`/list/<any-id>\`
5. **Save as PNG** to this directory with names: \`home.png\`, \`explore.png\`, \`hub.png\`, \`list.png\`

## Automated Capture (Recommended)

Install Playwright and run:

\`\`\`bash
npm install -D playwright
npx playwright install chromium
npm run dev  # Start server in one terminal
npm run status:ui  # Run in another terminal
\`\`\`

---

*Placeholder files (PLACEHOLDER_*.txt) will be replaced automatically when real screenshots are captured.*
`;

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'INSTRUCTIONS.md'), instructions, 'utf8');
  console.log('✅ Placeholder screenshots created. See INSTRUCTIONS.md for manual capture.');
}

function createPlaceholder(pageName) {
  const placeholderPath = path.join(SCREENSHOT_DIR, `PLACEHOLDER_${pageName}.txt`);
  const content = `This is a placeholder for ${pageName}.png

To capture real screenshots:
1. Install Playwright: npm install -D playwright
2. Install browser: npx playwright install chromium
3. Start dev server: npm run dev
4. Run: npm run status:ui

Or capture manually:
1. Open http://localhost:5173 in Chrome
2. Set viewport to 375x812 (iPhone X)
3. Navigate to the ${pageName} page
4. Take screenshot and save as ${pageName}.png in docs/ui-status/screenshots/
`;
  fs.writeFileSync(placeholderPath, content, 'utf8');
  console.log(`  ✓ Created placeholder for ${pageName}`);
}

// Run if called directly
captureScreenshots().catch(error => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});

export { captureScreenshots };

